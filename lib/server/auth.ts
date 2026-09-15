import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";

export const SESSION_COOKIE = "fay_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionOperator {
  id: string;
  name: string;
  role: string;
}

/**
 * Lightweight operator identity, not a security boundary. The cookie holds
 * a plain operator id — there is no password, and this must never gate
 * access to anything sensitive. Its job is to answer "who is at the
 * console right now" so dispatch/override events can be attributed and the
 * top bar can show a real name instead of a generic "OP" placeholder.
 */
export async function getSessionOperator(): Promise<SessionOperator | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const operator = await prisma.operator.findUnique({ where: { id } });
  if (!operator) return null;
  return { id: operator.id, name: operator.name, role: operator.role };
}

export async function createSession(name: string, role: string): Promise<SessionOperator> {
  const trimmed = name.trim();
  const operator = await prisma.operator.upsert({
    where: { name: trimmed },
    update: { role, lastSeenAt: new Date() },
    create: { name: trimmed, role, lastSeenAt: new Date() },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, operator.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { id: operator.id, name: operator.name, role: operator.role };
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
