import { getAuth } from "@/lib/auth";
import { sameOrigin, rateLimit } from "@/lib/security";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
const allowed = new Set([
  "get-session",
  "sign-in/username",
  "sign-out",
  "passkey/generate-register-options",
  "passkey/verify-registration",
  "passkey/generate-authenticate-options",
  "passkey/verify-authentication",
  "passkey/list-user-passkeys",
  "passkey/delete-passkey",
  "passkey/update-passkey",
  "change-password",
  "delete-user",
  "list-sessions",
  "revoke-session",
  "revoke-other-sessions",
]);
async function handle(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/auth/", "");
  try {
    const auth = getAuth();
    if (request.method === "POST" && !(await sameOrigin()))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    if (path === "sign-up/email" && request.method === "POST") {
      if (!(await rateLimit("create-account", 5, 60)))
        return NextResponse.json(
          { message: "Please wait before creating another account." },
          { status: 429 },
        );
      const parsed = z
        .object({
          username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9_]{3,30}$/),
          password: z.string().min(15).max(128),
        })
        .safeParse(await request.json());
      if (!parsed.success)
        return NextResponse.json(
          {
            message:
              "Choose a username with 3–30 letters, numbers or underscores and a password with at least 15 characters.",
          },
          { status: 400 },
        );
      const response = await auth.api.signUpEmail({
        body: {
          ...parsed.data,
          name: parsed.data.username,
          email: `${randomUUID()}@accounts.invalid`,
        },
        headers: request.headers,
        asResponse: true,
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    if (!allowed.has(path))
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { message: "Account service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
