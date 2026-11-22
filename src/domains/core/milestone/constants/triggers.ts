// マイルストーントリガー定数
//
// ベースリポジトリが統合ポイントとして提供するトリガー名。
// 下流プロジェクトはこれらを使用するか、独自のトリガー名を定義できる。

/** 購入完了時 */
export const MILESTONE_TRIGGER_PURCHASE_COMPLETED = "purchase_completed";

/**
 * 本登録の完了時(auth の register() が登録の守り(idToken・メール一致・仮登録・招待コード)を通った後、
 * セッション発行の前に 1 回発火する)。登録ボーナスなど「登録したら 1 回だけ」の処理はこのトリガーの定義で書く
 */
export const MILESTONE_TRIGGER_USER_REGISTERED = "user_registered";
