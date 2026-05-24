// src/features/auth/services/server/session/token.ts

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import type { SessionUser, TokenPayload } from "@/features/core/auth/entities/session";
import { SessionUserSchema, TokenPayloadSchema } from "@/features/core/auth/entities/session";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { findUserById } from "@/features/core/user/services/server/finders/findUserById";
import { signUserToken, verifyUserToken, type SessionTokenClaims } from "@/lib/jwt";

// JWT クレームを Auth ドメインのセッション情報として扱うためのユーティリティ群。
//
// 設計方針:
// - JWT は「身元証明 (userId と認証手段)」に限定する。
// - SessionUser の権威 (status / role / isDemo / name 等) は常に DB に置く。
// - resolveSessionUser() は JWT 検証後に DB から最新のユーザーを取得し、
//   SessionUser を DB の現在値で構築する (= ステータス変更が次回リクエストで即時反映)。
// - JWT のみで足りる低レベル用途は resolveSessionUserFromTokenOnly() を使う。
//
// なぜ DB fresh をデフォルトにしているか:
// 管理画面でユーザーの status / role を変更しても、対象ユーザーが既ログインなら
// JWT cookie 内のクレームは古いままになる (stale JWT 問題)。authGuard が JWT の
// status を信用すると suspended / banned ユーザーが保護ページに残留できてしまうため、
// SessionUser を必ず DB と同期させる。

function parseTokenPayload(
  payload: SessionTokenClaims<Record<string, unknown>>,
): TokenPayload | null {
  // JWT のペイロードから必要なフィールドのみを抜き出し、Zod で正規化する。
  const parsed = TokenPayloadSchema.safeParse({
    ...payload,
    sub: typeof payload.sub === "string" ? payload.sub : undefined,
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function toSessionUserFromTokenPayload(payload: TokenPayload): SessionUser | null {
  // JWT クレームのみから SessionUser を構築する (DB アクセスなし)。
  const parsed = SessionUserSchema.safeParse({
    userId: payload.sub,
    role: payload.role,
    status: payload.status,
    isDemo: payload.isDemo,
    providerType: payload.providerType,
    providerUid: payload.providerUid,
    name: payload.name,
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

async function verifyAndParseToken(token: string): Promise<TokenPayload | null> {
  // JWT を検証してクレームを TokenPayload に正規化する。
  const verified = await verifyUserToken(token, {
    claimsParser: (payload) => parseTokenPayload(payload),
  });

  if (!verified) {
    return null;
  }

  return verified.claims;
}

/**
 * JWT を検証し、DB から最新のユーザー情報を取得して SessionUser を構築する。
 *
 * 戻り値の status / role / isDemo / name / providerType / providerUid はすべて
 * DB の現在値が反映される。JWT のクレームは userId の証明にのみ利用する。
 *
 * - JWT 検証失敗 → null
 * - DB にユーザーが存在しない / 論理削除済み → null
 * - DB アクセス障害 → null (安全側に倒し、stale 状態でのアクセスを許可しない)
 *
 * 通常の認可判定 (authGuard / getSessionUser / proxy) はすべて本 API を経由するため、
 * 管理画面でのステータス変更が次回リクエストで即時反映される。
 */
export async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  const payload = await verifyAndParseToken(token);
  if (!payload) {
    return null;
  }

  let dbUser;
  try {
    dbUser = await findUserById(payload.sub);
  } catch (error) {
    // DB アクセス障害時はセッション無効として扱う。stale な JWT クレームで
    // 認可判定が通ってしまうのを防ぐため、可用性より整合性を優先する。
    console.error("[resolveSessionUser] failed to fetch user from DB", error);
    return null;
  }

  if (!dbUser) {
    return null;
  }

  // 全セッション失効チェック: パスワード変更や status=banned/security_locked への
  // 遷移で sessionsInvalidatedAt が更新されている場合、それより前に発行された
  // JWT (= jwt.iat < invalidatedAt) は失効とみなす。
  // 発火元: invalidateSessionsForUser (src/features/core/auth/services/server/sessionInvalidation.ts)
  if (dbUser.sessionsInvalidatedAt) {
    const invalidatedAtSeconds = Math.floor(
      dbUser.sessionsInvalidatedAt.getTime() / 1000,
    );
    if (payload.iat < invalidatedAtSeconds) {
      return null;
    }
  }

  const parsed = SessionUserSchema.safeParse({
    userId: dbUser.id,
    role: dbUser.role,
    status: dbUser.status,
    isDemo: dbUser.isDemo,
    providerType: dbUser.providerType,
    providerUid: dbUser.providerUid,
    name: dbUser.name,
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

/**
 * JWT のクレームのみから SessionUser を構築する (DB アクセスなし)。
 *
 * 高頻度かつ stale を許容できる低レベル用途向け。JWT に焼き付けられた値は
 * 発行時点のスナップショットであり DB の現在値とは乖離し得るため、
 * ロール/ステータスに基づく認可判定には使わないこと。
 * 通常は resolveSessionUser() を使う。
 */
export async function resolveSessionUserFromTokenOnly(
  token: string,
): Promise<SessionUser | null> {
  const payload = await verifyAndParseToken(token);
  if (!payload) {
    return null;
  }

  return toSessionUserFromTokenPayload(payload);
}

export async function refreshSessionCookie(
  cookiesStore: ResponseCookies,
  user: SessionUser,
): Promise<void> {
  // ユーザー情報から新しいトークンを発行し、レスポンス用の Cookie ストアへ書き込む。
  const { token, expiresAt } = await signUserToken({
    subject: user.userId,
    claims: {
      role: user.role,
      status: user.status,
      isDemo: user.isDemo,
      providerType: user.providerType,
      providerUid: user.providerUid,
      name: user.name,
    },
  });

  issueSessionCookie({
    cookies: cookiesStore,
    token,
    expiresAt,
  });
}
