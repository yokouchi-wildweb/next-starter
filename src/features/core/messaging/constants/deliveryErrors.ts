// src/features/core/messaging/constants/deliveryErrors.ts
//
// 失敗した配達の理由の符号(AdminDeliveryRow.errorCode = last_error の「符号: 文」の符号の部分)の文。
// 管理の回の詳細が「なぜ失敗したか」を出す。provider の生の文は返さない(dispatchDto の決まり)ので、符号と文だけ。
// 知らない符号は符号のまま出す。server を import しない(client の部品からも読むため)

export const DELIVERY_ERROR_TEXT: Readonly<Record<string, string>> = {
  unsubscribe_key_missing: "配信停止の鍵(MESSAGING_UNSUBSCRIBE_SECRET)が無いので、配信停止の欄の要るメールを送らなかった",
  send_threw: "経路の送信の処理が例外で止まった",
  no_result: "経路が結果を返さなかった",
  delivery_missing: "配達の行が見つからなかった",
  definition_invalid: "連絡の定義が検査を通らなかった",
  dispatch_missing: "回が見つからなかった",
  render_failed: "メールの描き方が描けなかった",
  render_fallback: "連絡の描き方が描けず、既定の描き方で送った",
  rate_limited: "送り先の業者の回数の上限に当たった",
  invalid_address: "宛先の形が正しくない",
  timeout: "送り先の業者が時間内に応えなかった",
};
