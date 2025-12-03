// src/features/auth/services/server/session/getSessionUser.ts

import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { resolveSessionUser } from "./token";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    return null;
  }

  return resolveSessionUser(token);
}
