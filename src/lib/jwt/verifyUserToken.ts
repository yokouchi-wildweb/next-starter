// src/lib/jwt/verifyUserToken.ts

import { jwtVerify } from "jose";

import { getAuthJwtSecret } from "./secret";
import type {
  SessionTokenClaims,
  VerifyUserTokenOptions,
  VerifyUserTokenResult,
} from "./types";

/**
 * JWT を検証し、クレーム情報を返却する。検証に失敗した場合は `null` を返す。
 * ドメイン固有の正規化が必要な場合は `claimsParser` を利用する。
 */
export const verifyUserToken = async <TUserClaims = SessionTokenClaims<Record<string, unknown>>>(
  token: string | null | undefined,
  options: VerifyUserTokenOptions<TUserClaims> = {},
): Promise<VerifyUserTokenResult<TUserClaims>> => {
  if (!token) {
    return null;
  }

  try {
    const secret = getAuthJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      currentDate: options.currentDate,
    });

    if (typeof payload.expiresAt !== "string") {
      return null;
    }

    const expiresAtDate = new Date(payload.expiresAt);

    if (Number.isNaN(expiresAtDate.getTime())) {
      return null;
    }

    const baseClaims: SessionTokenClaims<Record<string, unknown>> = {
      ...payload,
      expiresAt: payload.expiresAt,
    };

    const claims = options.claimsParser
      ? options.claimsParser(baseClaims)
      : (baseClaims as unknown as TUserClaims);

    if (!claims) {
      return null;
    }

    const subject = typeof payload.sub === "string" ? payload.sub : null;

    return {
      subject,
      claims,
      expiresAt: expiresAtDate,
    };
  } catch {
    return null;
  }
};
