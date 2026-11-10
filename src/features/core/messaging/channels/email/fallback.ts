// src/features/core/messaging/channels/email/fallback.ts
//
// React の「クライアントで描き直す」フォールバックの印(L2.1)。部品が描画中に投げると、@react-email/render は
// 例外を投げずに Suspense の境界をクライアント描画に回した HTML(ほぼ空のメール)を返す。その印があれば送らない。
// - "<!--$!-->": クライアント描画に回した Suspense の境界
// - "$RX": その境界を描き直す script の関数名

const FALLBACK_MARKERS = ["<!--$!-->", "$RX"] as const;

/** 描画結果がフォールバックの印を持つか(持てば部品の誤り = 恒久の失敗) */
export function hasRenderFallbackMarker(html: string): boolean {
  return FALLBACK_MARKERS.some((marker) => html.includes(marker));
}
