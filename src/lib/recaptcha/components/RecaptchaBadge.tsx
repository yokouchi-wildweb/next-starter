// src/lib/recaptcha/components/RecaptchaBadge.tsx

"use client";

import { RECAPTCHA_V3_INTERNALS } from "@/lib/recaptcha/constants";

type RecaptchaBadgeProps = {
  /** 表示言語 */
  lang?: "en" | "ja";
  /** 追加のクラス名 */
  className?: string;
};

/**
 * reCAPTCHA 規約テキストコンポーネント
 *
 * reCAPTCHAバッジを非表示にする場合、Googleの規約により
 * このテキストをユーザーフローの中で表示する必要がある。
 *
 * @see https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge.-what-is-allowed
 */
export function RecaptchaBadge({ lang = "ja", className }: RecaptchaBadgeProps) {
  // reCAPTCHA v3が無効な場合は何も表示しない
  if (!RECAPTCHA_V3_INTERNALS.hasSiteKey) {
    return null;
  }

  const privacyUrl = "https://policies.google.com/privacy";
  const termsUrl = "https://policies.google.com/terms";

  const linkClass = "text-primary hover:underline";

  if (lang === "en") {
    return (
      <p className={className ?? "text-xs text-muted-foreground"}>
        This site is protected by reCAPTCHA and the Google{" "}
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href={termsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Terms of Service
        </a>{" "}
        apply.
      </p>
    );
  }

  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      このサイトはreCAPTCHAによって保護されており、Googleの
      <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        プライバシーポリシー
      </a>
      と
      <a href={termsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        利用規約
      </a>
      が適用されます。
    </p>
  );
}
