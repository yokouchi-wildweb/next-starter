// src/proxies/featureGate.ts

import { NextResponse } from "next/server";
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
};

/**
 * ドメインごとのロックルール
 * isEnabled が false を返す場合、pathPatterns に一致するパスは404になる
 */
const FEATURE_GATE_RULES: FeatureGateRule[] = [
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
  // デモページ
  {
    pathPatterns: ["/demo"],
    isEnabled: () => APP_FEATURES.demo.samplePages,
  },
  // デモログイン
  {
    pathPatterns: ["/demo-login"],
    isEnabled: () => APP_FEATURES.demo.login,
  },
];

/**
 * 機能フラグに基づいてルートをブロックするProxy
 * 無効な機能のパスにアクセスした場合は404を返す
 */
export const featureGateProxy: ProxyHandler = (request) => {
  const pathname = request.nextUrl.pathname;

  for (const rule of FEATURE_GATE_RULES) {
    if (!rule.isEnabled()) {
      for (const pattern of rule.pathPatterns) {
        if (pathname.startsWith(pattern)) {
          return NextResponse.rewrite(new URL("/404", request.url));
        }
      }
    }
  }
};
