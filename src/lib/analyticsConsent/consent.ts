// src/lib/analyticsConsent/consent.ts
//
// アクセス解析の同意の状態と、送ってよいかの判定（計測サービスに依存しない）。
// 状態はこのタブのメモリにだけ持つ。選択の保存は同意バナー / CMP の持ち物で、読み込み時とクリック時に
// setAnalyticsConsent で渡してもらう。

import { ANALYTICS_CONFIG } from "@/config/app/analytics.config";

/** 同意の状態。unknown = まだ回答が無い（送らない側として扱う） */
export type AnalyticsConsent = "granted" | "denied" | "unknown";

/** 判定に使う設定（テストで差し替えられるよう引数でも受ける） */
export type AnalyticsGateConfig = {
  enabled: boolean;
  consent: "required" | "notRequired";
};

let current: AnalyticsConsent = "unknown";
const listeners = new Set<(consent: AnalyticsConsent) => void>();

/** 今の同意の状態 */
export function getAnalyticsConsent(): AnalyticsConsent {
  return current;
}

/**
 * 同意の状態を渡す。同意バナー / CMP から、ページの読み込み時（保存済みの選択）と、選択が変わったときに呼ぶ。
 * 値が変わったときだけ購読者に知らせる。
 */
export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  if (consent === current) return;
  current = consent;
  for (const listener of listeners) listener(consent);
}

/** 同意の変化を購読する。戻り値で解除する */
export function subscribeAnalyticsConsent(
  listener: (consent: AnalyticsConsent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 設定と同意の組み合わせから、送ってよいかを決める（純関数） */
export function decideAnalyticsAllowed(
  config: AnalyticsGateConfig,
  consent: AnalyticsConsent,
): boolean {
  if (!config.enabled) return false;
  if (config.consent === "notRequired") return true;
  return consent === "granted";
}

/**
 * 今、アクセス解析を送ってよいか。
 * 計測サービスの実装（page_view・trackEvent・初期化）は、送る前に必ずこれを確かめる。
 */
export function isAnalyticsAllowed(): boolean {
  return decideAnalyticsAllowed(ANALYTICS_CONFIG, current);
}
