// src/proxies/featureGate.ts

import { NextResponse, type NextRequest } from "next/server";
import { APP_FEATURES } from "@/config/app/app-features.config";
import type { ProxyHandler } from "./types";

// ============================================
// ドメインロック定義
// APP_FEATURES の設定に基づき、対応するパスをブロックする
// ============================================

type FeatureGateRule = {
  /** ブロック対象のパスパターン（前方一致） */
  pathPatterns: string[];
  /** この機能が有効かどうかを判定する関数 */
  isEnabled: () => boolean;
  /** ブロック時のリダイレクト先（省略時は /404） */
  redirectTo?: string;
};

/**
 * ドメインごとのロックルール
 * isEnabled が false を返す場合、pathPatterns に一致するパスは404になる
 */
const FEATURE_GATE_RULES: FeatureGateRule[] = [
  // サインアップ
  {
    pathPatterns: [
      "/signup",
      "/api/auth/register",
      "/api/auth/pre-register",
      "/api/auth/send-email-link",
      "/api/auth/send-early-registration-link",
    ],
    isEnabled: () => APP_FEATURES.auth.signup.enabled,
    redirectTo: "/signup-closed",
  },
  // ウォレット
  {
    pathPatterns: ["/wallet", "/api/wallet", "/api/admin/wallet"],
    isEnabled: () => APP_FEATURES.wallet.enabled,
  },
  // マーケティング > クーポン
  {
    pathPatterns: ["/admin/coupons"],
    isEnabled: () => APP_FEATURES.marketing.coupon.enabled,
  },
  // デモページ（裏側の API ルートも併せて無効化する）
  {
    pathPatterns: ["/demo", "/api/demo"],
    isEnabled: () => APP_FEATURES.demo.samplePages,
  },
  // デモログイン
  {
    pathPatterns: ["/demo-login"],
    isEnabled: () => APP_FEATURES.demo.login,
  },
  // マーケティング > 紹介
  {
    pathPatterns: ["/mypage/invite", "/api/referral", "/api/admin/referral"],
    isEnabled: () => APP_FEATURES.marketing.referral.enabled,
  },
  // ユーザータグ
  {
    pathPatterns: ["/admin/user-tags", "/api/userTag"],
    isEnabled: () => APP_FEATURES.user.enableUserTag,
  },
  // マーケティング > お知らせ
  {
    pathPatterns: ["/admin/notifications", "/api/notification/send"],
    isEnabled: () => APP_FEATURES.marketing.notification.enableAdminBroadcast,
  },
];

/**
 * パスがパターンに一致するか判定する（セグメント境界マッチ）
 * pattern と完全一致、または pattern 直下（"/" 区切り）のパスのみ一致する。
 * 単純な前方一致と異なり、`/demo` が `/demo-login` を巻き込まない。
 * 末尾スラッシュ付きパターン（"/demo/"）も "/demo" と同義として扱う。
 */
function matchesPath(pathname: string, pattern: string): boolean {
  const normalized = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
  return pathname === normalized || pathname.startsWith(normalized + "/");
}

/**
 * ブロック時のレスポンスを生成する。
 * - redirectTo が指定されていれば常にそこへ rewrite（従来挙動を維持）
 * - 未指定の API ルート（/api/）は純粋な 404 ステータスを返す
 * - それ以外（ページ）は /404 へ rewrite
 */
function blockResponse(request: NextRequest, redirectTo?: string): NextResponse {
  if (redirectTo) {
    return NextResponse.rewrite(new URL(redirectTo, request.url));
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.rewrite(new URL("/404", request.url));
}

/**
 * 機能フラグに基づいてルートをブロックするProxy
 * 無効な機能のパスにアクセスした場合は404を返す
 */
export const featureGateProxy: ProxyHandler = (request) => {
  const pathname = request.nextUrl.pathname;

  for (const rule of FEATURE_GATE_RULES) {
    if (rule.isEnabled()) continue;
    if (rule.pathPatterns.some((pattern) => matchesPath(pathname, pattern))) {
      return blockResponse(request, rule.redirectTo);
    }
  }
};
