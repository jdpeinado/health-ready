import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { toHex } from "./encoding.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toHex(new Uint8Array(digest));
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  db: Db,
  userId: string,
  expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS),
): Promise<CreatedSession> {
  const token = generateToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashToken(token),
    expiresAt,
    createdAt: new Date(),
  });
  return { token, expiresAt };
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "user";
}

export async function validateSession(
  db: Db,
  token: string,
): Promise<{ user: SessionUser } | null> {
  const tokenHash = await hashToken(token);
  const row = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .get();
  return row ? { user: row } : null;
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
