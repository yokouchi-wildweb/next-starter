// src/lib/recaptcha/components/RecaptchaBadge.tsx

"use client";

import { RECAPTCHA_V3_INTERNALS } from "@/lib/recaptcha/constants";

/**
 * reCAPTCHA バッジ表示コンポーネント
 *
 * サイト全体ではバッジが非表示になっているため、
 * バッジを表示したいページにこのコンポーネントを設置する。
 *
 * 設置すると右下にreCAPTCHAバッジが表示される。
 */
export function RecaptchaBadge() {
  // reCAPTCHA v3が無効な場合は何もしない
  if (!RECAPTCHA_V3_INTERNALS.hasSiteKey) {
    return null;
  }

  return (
    <style jsx global>{`
      .grecaptcha-badge {
        visibility: visible !important;
      }
    `}</style>
  );
}
