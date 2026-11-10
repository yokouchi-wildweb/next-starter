// src/features/auth/services/server/session/token.ts

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import type { SessionUser, TokenPayload } from "@/features/core/auth/entities/session";
import { SessionUserSchema, TokenPayloadSchema } from "@/features/core/auth/entities/session";
import { issueSessionCookie } from "@/features/core/auth/services/server/session/issueSessionCookie";
import { findUserById } from "@/features/core/user/services/server/finders/findUserById";
import {
  verifyUserToken,
  type SessionTokenClaims,
} from "@/lib/jwt";
import { isBeforeSessionInvalidation } from "./invalidationBoundary";
import { issueSessionToken } from "./sessionToken";

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
// JWT cookie 内のクレームは古いままになる (stale JWT 問題)。ページの守りが JWT の
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
 * セッションの利用者を DB で確かめた結果。
 * - { user }: 確かめられた（user = null は未ログイン同然: JWT 不正・削除済み・失効）
 * - { unavailable }: 確かめられない（DB アクセス障害）。「利用者なし」とは区別する
 */
export type SessionUserOutcome =
  | { user: SessionUser | null; unavailable?: undefined }
  | { user?: undefined; unavailable: true; error: unknown };

/**
 * JWT を検証し、DB から最新のユーザー情報を取得して SessionUser を構築する（障害を「利用者なし」と区別する形）。
 *
 * 戻り値の status / role / isDemo / name / providerType / providerUid はすべて
 * DB の現在値が反映される。JWT のクレームは userId の証明にのみ利用する。
 *
 * - JWT 検証失敗 → { user: null }
 * - DB にユーザーが存在しない / 論理削除済み / 全セッション失効 → { user: null }
 * - DB アクセス障害 → { unavailable: true }（stale な JWT クレームには落とさない）
 *
 * 直接使うのは resolveSessionUser と getSessionUser.ts の cache（リクエスト内 1 回）。ページの守り等は障害も null、
 * API の Factory は getSessionUserForRoute（障害は throw → 503）を使う。
 */
export async function resolveSessionUserOutcome(token: string): Promise<SessionUserOutcome> {
  const payload = await verifyAndParseToken(token);
  if (!payload) {
    return { user: null };
  }

  let dbUser;
  try {
    dbUser = await findUserById(payload.sub);
  } catch (error) {
    // DB アクセス障害。stale な JWT クレームで認可判定が通ってしまうのを防ぐため、
    // 利用者は返さない（可用性より整合性を優先）。null に畳むかどうかは呼び手が決める
    console.error("[resolveSessionUser] failed to fetch user from DB", error);
    return { unavailable: true, error };
  }

  if (!dbUser) {
    return { user: null };
  }

  // 全セッション失効チェック: パスワード変更や status=banned/security_locked への
  // 遷移で sessionsInvalidatedAt が更新されている場合、それより前に発行された
  // JWT (= jwt.iat < invalidatedAt) は失効とみなす。
  // 発火元: invalidateSessionsForUser (src/features/core/auth/services/server/sessionInvalidation.ts)
  // 比較は ./invalidationBoundary.ts(Firebase の ID トークンの交換と同じ境目)
  if (isBeforeSessionInvalidation(payload.iat, dbUser.sessionsInvalidatedAt)) {
    return { user: null };
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
    return { user: null };
  }

  return { user: parsed.data };
}

/**
 * JWT を検証し、DB から最新のユーザー情報を取得して SessionUser を構築する。
 *
 * - JWT 検証失敗 → null
 * - DB にユーザーが存在しない / 論理削除済み → null
 * - DB アクセス障害 → null (安全側に倒し、stale 状態でのアクセスを許可しない)
 *
 * ページの守り guard.ts / getSessionUser / proxy は本 API（の cache 版）を経由するため、
 * 管理画面でのステータス変更が次回リクエストで即時反映される。
 * 障害と「利用者なし」を区別したいとき（API の Factory）は resolveSessionUserOutcome を使う。
 */
export async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  const outcome = await resolveSessionUserOutcome(token);
  return outcome.unavailable ? null : outcome.user;
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

/**
 * SessionUser から新しいトークンを発行し、レスポンス用の Cookie ストアへ書き込む。
 *
 * user は必ず DB の現在値 (resolveSessionUser / DB 行) から組み立てること。
 * 旧トークンのクレームをそのまま渡すと、強制失効 (sessions_invalidated_at) を
 * すり抜けた新トークンを発行してしまう。
 * デモユーザーは短いセッション時間 (demo の設定 session.maxAgeSeconds、sessionToken の demoSessionMaxAgeSeconds) を維持する。
 */
export async function refreshSessionCookie(
  cookiesStore: ResponseCookies,
  user: SessionUser,
): Promise<{ expiresAt: Date }> {
  // SessionUser からトークンを署名する(isDemo ならデモの短い時間)。establishSession と同じ部品
  const { token, expiresAt, maxAge } = await issueSessionToken({
    id: user.userId,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    name: user.name ?? null,
  });

  issueSessionCookie({
    cookies: cookiesStore,
    token,
    expiresAt,
    maxAge,
  });

  return { expiresAt };
}
