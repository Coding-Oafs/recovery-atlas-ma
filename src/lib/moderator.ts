import "server-only";
import { isAdmin } from "./security";
import { member } from "./member";
import { db } from "./db";
export async function moderator() {
  if (await isAdmin()) return { id: "administrator", owner: true };
  const user = await member();
  if (!user) return null;
  const [role] =
    await db()`SELECT 1 FROM atlas_community_role WHERE user_id=${user.id} AND role='moderator'`;
  return role ? { id: user.id, owner: false } : null;
}
export async function requireModerator() {
  const user = await moderator();
  if (!user) throw Error("Moderator access required");
  return user;
}
