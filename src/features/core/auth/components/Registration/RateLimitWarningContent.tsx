// src/features/core/auth/components/Registration/RateLimitWarningContent.tsx
// ダウンストリームで文言をカスタマイズする場合はこのファイルを編集してください。

import { Para } from "@/components/TextBlocks";
import type { HttpError } from "@/lib/errors";

/** モーダルタイトル */
export const RATE_LIMIT_WARNING_TITLE = "重複したユーザー登録が確認されました。";

/** モーダル本文 */
export function RateLimitWarningContent() {
  return (
    <Para>
      同一人物による複数アカウントの作成は
      <br />
      重大な利用規約違反となります。
    </Para>
  );
}

/**
 * サブネット単位のレート制限（silent: true）かどうかを判定する。
 * silent の場合はモーダルではなくフォームエラーとして表示する。
 */
export function isSilentRateLimit(error: HttpError): boolean {
  const data = error.responseData;
  return typeof data === "object" && data !== null && "silent" in data && (data as { silent: boolean }).silent === true;
}
