// src/lib/spamGuard/checker.ts

import MailChecker from "mailchecker";

import { APP_FEATURES } from "@/config/app/app-features.config";

import { checkDebounce } from "./debounce";
import { ALLOWED_TLDS, TRUSTED_DOMAINS } from "./whitelist";

/**
 * メールアドレスからドメインを抽出する
 */
function extractDomain(email: string): string {
  const parts = email.toLowerCase().split("@");
  return parts[1] || "";
}

/**
 * ドメインからTLDを抽出する
 * 例: "example.co.jp" → "jp", "example.com" → "com"
 */
function extractTld(domain: string): string {
  const parts = domain.split(".");
  return parts[parts.length - 1] || "";
}

/**
 * TLDが許可リストに含まれているかチェックする
 */
function isTldAllowed(domain: string): boolean {
  const tld = extractTld(domain);
  return ALLOWED_TLDS.has(tld);
}

/**
 * 使い捨てメールアドレスかどうかをチェックする
 *
 * チェックモード:
 * - disabled: チェックなし（常に通過）
 * - full: 4段階フルチェック（信頼ドメイン→TLD→OSS→DeBounce）
 * - strict: 信頼ドメイン（TRUSTED_DOMAINS）のみ許可
 *
 * @returns true = 使い捨てメール（ブロック対象）, false = 正規メール（通過）
 */
export async function isDisposableEmail(email: string): Promise<boolean> {
  const mode = APP_FEATURES.auth.signup.emailCheckMode;

  // disabled: チェックなし
  if (mode === "disabled") {
    return false;
  }

  const domain = extractDomain(email);

  if (!domain) {
    // ドメインが取得できない場合はブロック
    return true;
  }

  // [1] 信頼ドメインホワイトリスト → 無条件通過（全モード共通）
  if (TRUSTED_DOMAINS.has(domain)) {
    return false;
  }

  // strict: 信頼ドメイン以外は全てブロック
  if (mode === "strict") {
    return true;
  }

  // full モード: 以降のチェックを実行

  // [2] TLD ホワイトリスト → 不一致でブロック
  if (!isTldAllowed(domain)) {
    return true;
  }

  // [3] OSS ブラックリスト（mailchecker）
  if (!MailChecker.isValid(email)) {
    return true;
  }

  // [4] DeBounce API（失敗時はスキップして通過）
  const isDisposable = await checkDebounce(email);
  return isDisposable;
}
