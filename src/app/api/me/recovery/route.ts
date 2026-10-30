import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { member, privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
import { db } from "@/lib/db";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
const digest = (code: string) =>
  createHash("sha256")
    .update(code.replace(/-/g, "").toLowerCase())
    .digest("hex");
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const body = await request.json(),
      sql = db(),
      auth = getAuth();
    if (body.action === "generate") {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return reply({ error: "Sign in first." }, 401);
      if (Date.now() - new Date(session.session.createdAt).getTime() > 600000)
        return reply(
          {
            error:
              "Sign out and sign in again before changing your recovery code.",
          },
          403,
        );
      if (!(await rateLimit("generate-recovery", 10, 60)))
        return reply(
          { error: "Please wait before replacing your recovery code." },
          429,
        );
      const code = randomBytes(24)
        .toString("hex")
        .match(/.{1,8}/g)!
        .join("-");
      await sql`INSERT INTO atlas_recovery(user_id,code_hash) VALUES(${session.user.id},${digest(code)}) ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,created_at=now()`;
      return reply({ code });
    }
    if (!(await rateLimit("recover-account", 5, 15)))
      return reply(
        { error: "Please wait before trying account recovery again." },
        429,
      );
    const parsed = z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9_]{3,30}$/),
        code: z.string().regex(/^[a-f0-9-]{48,53}$/i),
        password: z.string().min(15).max(128),
      })
      .safeParse(body);
    if (!parsed.success)
      return reply(
        {
          error:
            "Enter your username, recovery code and a new password of at least 15 characters.",
        },
        400,
      );
    const { username, code, password } = parsed.data;
    // Atomically consume the high-entropy recovery credential before using the library's reset flow.
    const [row] =
      await sql`DELETE FROM atlas_recovery r USING atlas_user u WHERE r.user_id=u.id AND u.username=${username} AND r.code_hash=${digest(code)} RETURNING r.user_id`;
    if (!row)
      return reply(
        {
          error:
            "The username or recovery code is incorrect, or the code has already been used.",
        },
        400,
      );
    const context = await auth.$context,
      token = randomBytes(32).toString("hex");
    try {
      await context.internalAdapter.createVerificationValue({
        identifier: `reset-password:${token}`,
        value: row.user_id,
        expiresAt: new Date(Date.now() + 60000),
      });
      await auth.api.resetPassword({ body: { token, newPassword: password } });
      await sql`DELETE FROM atlas_passkey WHERE "userId"=${row.user_id}`;
    } catch {
      await sql`INSERT INTO atlas_recovery(user_id,code_hash) VALUES(${row.user_id},${digest(code)}) ON CONFLICT DO NOTHING`;
      throw Error("Recovery unavailable");
    }
    return reply({ ok: true });
  } catch {
    return reply(
      {
        error: "Account recovery is temporarily unavailable. Please try again.",
      },
      503,
    );
  }
}
