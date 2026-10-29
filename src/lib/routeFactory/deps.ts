// src/lib/routeFactory/deps.ts
//
// 汎用の Factory に差し込む値の型。lib/routeFactory は主体（ログイン中の利用者・登録端末）の解き方と
// access の評価、ドメイン名 → 登録行の表を自分で import せず、ここで決めた形で受け取る。
// 束を作るのは持ち主のドメイン（利用者 = features/core/auth、端末 = features/core/pairedDevice）、
// 結ぶのは src/wiring/apiRoute.ts。全項目必須（足りない束は型で止まる）。

import type { NextRequest, NextResponse } from "next/server";

import type { RateLimitCategory } from "@/config/app/rate-limit.config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import type { UserStatus } from "@/features/core/user/types";
import type { DomainApiAccessRule, DomainRegistry } from "@/lib/domain";

/**
 * access の評価結果
 * - granted: 許可 / not_found: 存在しないものとして扱う（"none"）
 * - unauthenticated: 未認証（401） / forbidden: 権限不足・利用できない status（403）
 */
export type RouteAccessDecision = "granted" | "not_found" | "unauthenticated" | "forbidden";

/** 利用者の束（features/core/auth が export する） */
export type RouteUserDeps = {
  /**
   * Cookie から DB 同期の利用者を解く（未ログイン・失効なら null）。
   * Factory はリクエストごとに 1 回だけ呼ぶ（同じリクエストの重複は持ち主側の cache で 1 回に）
   */
  resolveUser: () => Promise<SessionUser | null>;
  /**
   * JWT のクレームだけの利用者（DB を引かない）。監査の actor とデモ判定の内部用で、認可には使わない
   */
  resolveTokenSession: () => Promise<SessionUser | null>;
  /** access を利用者と照合する。allowStatuses 省略時は availableStatuses だけを通す */
  evaluateAccess: (
    rule: DomainApiAccessRule,
    user: SessionUser | null,
    options: { allowStatuses?: readonly UserStatus[] },
  ) => RouteAccessDecision;
  /** 既定で通す status（access "public" の ctx.user もこの status のときだけ非 null） */
  availableStatuses: readonly UserStatus[];
};

/** 認証済みの登録端末（持ち主 features/core/pairedDevice の形を Factory は中身まで見ない） */
export type RouteAuthenticatedDevice<TDevice = unknown> = { device: TDevice & { deviceId: string; kind: string } };

/** 登録端末の束（features/core/pairedDevice が export する） */
export type RouteDeviceDeps<TAuthenticated extends RouteAuthenticatedDevice = RouteAuthenticatedDevice> = {
  /** リクエストの Cookie から端末を認証する（無い・失効・期限切れなら null） */
  authenticateRequestDevice: (req: NextRequest) => Promise<TAuthenticated | null>;
  /** 端末への応答の Cookie の期限を DB の期限に合わせて書き直す */
  syncPairedDeviceCookie: (response: NextResponse, req: NextRequest, authenticated: TAuthenticated) => NextResponse;
  /** 主体（端末 id / ユーザー id）単位のレート制限。超えていれば 429 の応答 */
  checkPairedDeviceRateLimit: (category: RateLimitCategory, identifier: string) => Promise<NextResponse | null>;
  /** 端末の領域のエラーを応答にする（該当しなければ null） */
  pairedDeviceErrorResponse: (error: unknown) => NextResponse | null;
};

/** createRouteFactories に渡す束 */
export type RouteFactoryDeps<TAuthenticated extends RouteAuthenticatedDevice = RouteAuthenticatedDevice> = {
  user: RouteUserDeps;
  device: RouteDeviceDeps<TAuthenticated>;
  /** 汎用 CRUD（/api/[domain]/**）がドメイン名から行（access・遅延 service）を引く登録表 */
  domains: DomainRegistry;
};
