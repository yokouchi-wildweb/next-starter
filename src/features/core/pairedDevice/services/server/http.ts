// src/features/core/pairedDevice/services/server/http.ts
//
// 端末・ペアリング API の HTTP まわりの共通処理。
// - PairedDeviceError を { message, reason } の JSON に変換する（画面は reason で表示を切り替える）
// - 主体単位のレート制限（理由 rate_limited 付きの 429）
// - 公開 POST へのクロスサイト送信の拒否

import { NextResponse, type NextRequest } from "next/server";

import type { RateLimitCategory } from "@/config/app/rate-limit.config";
import { checkRateLimit } from "@/features/core/rateLimit/services/server/wrappers/rateLimitHelper";
import { getAppBaseUrl } from "@/lib/url";

import { isPairedDeviceError } from "./kinds";

/** PairedDeviceError なら理由付きのレスポンスを返す。それ以外は null（呼び出し側で再 throw する） */
export function pairedDeviceErrorResponse(error: unknown): NextResponse | null {
  if (!isPairedDeviceError(error)) return null;
  return NextResponse.json({ message: error.message, reason: error.reason }, { status: error.status });
}

/**
 * ハンドラを包み、PairedDeviceError を理由付きのレスポンスに変換する。
 * それ以外のエラーは routeFactory の既定の変換（{ message }）に任せる。
 */
export async function withPairedDeviceErrors<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (error) {
    const response = pairedDeviceErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/**
 * IP 以外の単位（端末 id・ユーザー id・照合トークン）でレート制限する。超えていれば 429（reason rate_limited）。
 * 店内の端末は同じ IP から来るので、IP 単位の制限は緩い上限だけにし、主な制限はこちらでかける
 */
export async function checkPairedDeviceRateLimit(
  category: RateLimitCategory,
  identifier: string,
): Promise<NextResponse | null> {
  const limit = await checkRateLimit(category, identifier);
  if (limit.allowed) return null;
  const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    {
      message: "リクエスト回数の上限に達しました。しばらく経ってから再度お試しください。",
      reason: "rate_limited",
      resetAt: limit.resetAt,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/**
 * 公開の POST（ペアリング・登録解除）へのクロスサイト送信を拒否する。拒否するときは 403 を返す。
 * 他サイトのページから端末のブラウザに送らせ、攻撃者のコードで端末を登録させる
 * （ログイン CSRF の端末版）のを防ぐ。
 *
 * 判定: Sec-Fetch-Site があれば same-origin / none だけを通す（最近のブラウザは常に送る）。
 * 無ければ Origin がある場合だけ、アプリのベース URL（getAppBaseUrl）の origin と一致を求める。
 * どちらも無い（古いブラウザ・サーバー間）なら通す。ベース URL が未設定なら確認を省く（開発環境向け）。
 */
export function rejectCrossSiteRequest(req: NextRequest): NextResponse | null {
  const forbidden = () =>
    NextResponse.json(
      { message: "このリクエストは受け付けられません。", reason: "forbidden" },
      { status: 403 },
    );

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin" || fetchSite === "none" ? null : forbidden();
  }

  const origin = req.headers.get("origin");
  if (!origin) return null;
  let appOrigin: string;
  try {
    appOrigin = new URL(getAppBaseUrl()).origin;
  } catch {
    return null;
  }
  return origin === appOrigin ? null : forbidden();
}
