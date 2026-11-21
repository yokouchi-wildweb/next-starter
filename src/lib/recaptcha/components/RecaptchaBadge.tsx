// src/lib/recaptcha/components/RecaptchaBadge.tsx

"use client";

import { hasRecaptchaSiteKey } from "../siteKey";

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
  if (!hasRecaptchaSiteKey("v3")) {
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
