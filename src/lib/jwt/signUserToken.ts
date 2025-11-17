// src/lib/jwt/signUserToken.ts

import { SignJWT } from "jose";

import { SESSION_DEFAULT_MAX_AGE_SECONDS, SESSION_JWT_ALGORITHM } from "./constants";
import { getAuthJwtSecret } from "./secret";
import type { SessionTokenClaims, SignUserTokenParams, SignUserTokenResult } from "./types";

/**
 * 任意のクレームから署名付き JWT を生成する。
 */
export const signUserToken = async <TUserClaims extends Record<string, unknown>>(
  params: SignUserTokenParams<TUserClaims>,
): Promise<SignUserTokenResult<TUserClaims>> => {
  const { subject, claims, options = {} } = params;

  const issuedAt = options.issuedAt ?? new Date();
  const maxAge = options.maxAge ?? SESSION_DEFAULT_MAX_AGE_SECONDS;
  const expiresAt = new Date(issuedAt.getTime() + maxAge * 1000);
  const secret = getAuthJwtSecret();

  const payload: SessionTokenClaims<TUserClaims> = {
    ...claims,
    expiresAt: expiresAt.toISOString(),
  };

  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: SESSION_JWT_ALGORITHM, typ: "JWT" })
    .setSubject(subject)
    .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  return { token, expiresAt, payload };
};
