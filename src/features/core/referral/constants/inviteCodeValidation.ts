// 招待コード検証のユーザー向け文言
//
// 公開 API（POST /api/referral/validate-invite-code）は理由を区別せずこの1文言だけを返す
// （存在しない / 期限切れ / 種別違い を区別するとコード存在の列挙に使えるため）。

export const INVITE_CODE_INVALID_MESSAGE = "無効な招待コードです。";

/** 「適用」で有効と確認できたときの表示 */
export const INVITE_CODE_APPLIED_MESSAGE = "有効な招待コードです";

/** 入力欄に未適用の文字が残ったまま送信しようとしたときの文言（送信をブロック） */
export const INVITE_CODE_UNAPPLIED_MESSAGE =
  "「適用」を押して招待コードを確認してください。使用しない場合は空欄にしてください。";

/** 通信エラー等で確認できなかったときの文言 */
export const INVITE_CODE_CHECK_FAILED_MESSAGE = "招待コードの確認に失敗しました。";
