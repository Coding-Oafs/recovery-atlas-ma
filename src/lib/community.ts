import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { member } from "./member";
export const profileInput = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500),
  region: z.string().trim().max(80),
  languages: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
  discoverable: z.boolean(),
  acceptsRequests: z.boolean(),
  adultConfirmed: z.boolean(),
  guidelinesAccepted: z.boolean(),
});
export class CommunityError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function encryptPrivate(text: string) {
  const secret = process.env.MESSAGE_ENCRYPTION_SECRET;
  if (!secret) throw Error("Message encryption not configured");
  const key = Buffer.from(
      hkdfSync("sha256", secret, "recovery-atlas", "community-message-v1", 32),
    ),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  return [
    "v1",
    iv.toString("base64url"),
    Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString(
      "base64url",
    ),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function decryptPrivate(value: string) {
  const [version, nonce, body, tag] = value.split(".");
  if (version !== "v1") throw Error("Unknown encrypted record");
  const secret = process.env.MESSAGE_ENCRYPTION_SECRET;
  if (!secret) throw Error("Message encryption not configured");
  const key = Buffer.from(
      hkdfSync("sha256", secret, "recovery-atlas", "community-message-v1", 32),
    ),
    cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(nonce, "base64url"),
    );
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    cipher.update(Buffer.from(body, "base64url")),
    cipher.final(),
  ]).toString("utf8");
}
export async function communityMember() {
  const user = await member();
  if (!user)
    throw new CommunityError("Sign in to use your community profile.", 401);
  const [profile] =
    await db()`SELECT * FROM atlas_profile WHERE user_id=${user.id}`;
  if (profile?.suspended)
    throw new CommunityError(
      "Community access is paused. Contact the directory through its feedback form.",
      403,
    );
  return { user, profile };
}
export function requireAdult(profile: Record<string, unknown> | undefined) {
  if (!profile?.adult_confirmed || !profile?.guidelines_at)
    throw new CommunityError(
      "Confirm you are 18 or older and accept the community guidelines in your profile before messaging.",
      403,
    );
}
export async function ownConversation(id: string, userId: string) {
  if (!z.uuid().safeParse(id).success)
    throw new CommunityError("Conversation not found.", 404);
  const [row] =
    await db()`SELECT c.*,EXISTS(SELECT 1 FROM atlas_block b WHERE (b.blocker=c.requester AND b.blocked=c.recipient) OR (b.blocker=c.recipient AND b.blocked=c.requester)) AS blocked FROM atlas_conversation c WHERE c.id=${id}::uuid AND (${userId}=c.requester OR ${userId}=c.recipient)`;
  if (!row) throw new CommunityError("Conversation not found.", 404);
  return row;
}
