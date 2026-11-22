// src/domains/core/messaging/constants/deliveryErrors.ts
//
// 失敗した配達の理由の符号(AdminDeliveryRow.errorCode = last_error の「符号: 文」の符号の部分)の文。
// 管理の送信の詳細が「なぜ失敗したか」を出す。provider の生の文は返さない(dispatchDto の決まり)ので、符号と文だけ。
// 知らない符号は符号のまま出す。server を import しない(client の部品からも読むため)

export const DELIVERY_ERROR_TEXT: Readonly<Record<string, string>> = {
  unsubscribe_key_missing: "配信停止リンクの設定がないため、配信停止リンクが必要なメールを送信しませんでした",
  send_threw: "送信処理でエラーが発生しました",
  no_result: "送信結果を受け取れませんでした",
  delivery_missing: "送信状況の記録が見つかりませんでした",
  definition_invalid: "通知の設定に誤りがあります",
  dispatch_missing: "送信が見つかりませんでした",
  render_failed: "メールの本文を作成できませんでした",
  render_fallback: "本文を作成できなかったため、既定の形式で送信しました",
  rate_limited: "送信サービスの送信数の上限に達しました",
  invalid_address: "宛先の形式が正しくありません",
  timeout: "送信サービスから時間内に応答がありませんでした",
  // 予約・後回しの送信をその記録から組み直せなかった(D128)
  values_missing: "送信の内容が記録に残っていないため、予約・後回しの送信を作成できませんでした",
  layout_missing: "送信に使うレイアウトが見つからないため、送信を作成できませんでした",
  layout_unreadable: "送信に使ったレイアウトの版が新しい版に読み替えられないため、送信を作成できませんでした",
};
