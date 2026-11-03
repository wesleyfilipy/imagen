import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { env, isProduction } from "./env";

const COOKIE = "bas_sid";
const SID_RE = /^[A-Za-z0-9_-]{43}$/;

/** Hash do id de sessão — o valor do cookie em si nunca é salvo no banco. */
export function hashSession(sid: string): string {
  return createHash("sha256").update(sid).digest("hex");
}

export async function getSessionHash(): Promise<string | null> {
  const sid = (await cookies()).get(COOKIE)?.value;
  return sid && SID_RE.test(sid) ? hashSession(sid) : null;
}

/** Só pode ser chamada em Route Handlers / Server Actions (escreve cookie). */
export async function getOrCreateSessionHash(): Promise<string> {
  const store = await cookies();
  let sid = store.get(COOKIE)?.value;
  if (!sid || !SID_RE.test(sid)) {
    sid = randomBytes(32).toString("base64url");
    store.set(COOKIE, sid, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return hashSession(sid);
}

export async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown";
  return createHmac("sha256", env.sessionSecret).update(ip).digest("hex");
}
