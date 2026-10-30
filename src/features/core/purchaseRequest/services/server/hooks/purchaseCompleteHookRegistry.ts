// 購入完了ポストフックの型と読み手(項目: ./definitions/<名前>[.<fork の名前>].ts の export const hook、一覧は生成物)
//
// completePurchase のトランザクション内で、ウォレット更新・クーポン使用後、
// マイルストーン評価前に実行されるフックを登録できる。
//
// マイルストーンとの違い:
// - マイルストーン: 条件付き、ユーザーあたり1回（冪等）、milestones テーブルに記録
// - ポストフック: 無条件（or フック内で自前判定）、毎購入で実行、記録はフック側の責務
//
// 使い方（下流プロジェクト）: definitions/rankBonus.<fork の名前>.ts
// ```ts
// export const hook: PurchaseCompleteHook = {
//   key: "rank_bonus",
//   priority: 10,
//   handler: async ({ purchaseRequest, walletResult, tx }) => {
//     // ランクボーナス付与など
//   },
// };
// ```
//
// 注意:
// - フックはトランザクション内で実行される。重い処理は避けること
// - 各フックは SAVEPOINT で分離される。個別フックの失敗は他のフックや購入処理をブロックしない

import { completeHooks } from "@/features/core/purchaseRequest/extensions/completeHooks";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type { WalletHistory } from "@/features/core/walletHistory/entities/model";
import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * ポストフックに渡されるパラメータ
 */
export type PurchaseCompleteHookParams = {
  /** 完了した購入リクエスト */
  purchaseRequest: PurchaseRequest;
  /**
   * ウォレット残高更新の結果
   *
   * history は nullable:
   *   - 従来の wallet_topup 購入では WalletHistory が入る（従来挙動）
   *   - ウォレット加算を伴わない購入（例: direct_sale）では null
   * フック側で history に依存する処理を行う場合は null チェックを行うこと。
   * 多くのフックは「wallet_topup 購入のみ対象」のはずなので、
   * `if (purchaseRequest.purchase_type !== "wallet_topup") return;`
   * または `if (!walletResult.history) return;` を handler 冒頭に入れるのが推奨パターン。
   */
  walletResult: { history: WalletHistory | null };
  /** トランザクションクライアント */
  tx: TransactionClient;
};

/**
 * ポストフック定義
 */
export type PurchaseCompleteHook = {
  /** フックの一意キー */
  key: string;
  /** 実行順（小さいほど先に実行。デフォルト: 0） */
  priority?: number;
  /** フック処理 */
  handler: (params: PurchaseCompleteHookParams) => Promise<void>;
};

let memo: PurchaseCompleteHook[] | null = null;

/**
 * 全フックを priority 昇順で取得する
 * 同じキーが複数あると後の項目(ファイル名の順)が勝つ(warn)。読み込みの途中で一覧を触らないよう初回に組み立てる
 */
export function getPurchaseCompleteHooks(): PurchaseCompleteHook[] {
  if (memo) return memo;
  const hooks = new Map<string, PurchaseCompleteHook>();
  for (const hook of completeHooks) {
    if (hooks.has(hook.key)) {
      console.warn(`[PurchaseCompleteHook] フック "${hook.key}" が複数あります。後の項目で上書きします。`);
    }
    hooks.set(hook.key, hook);
  }
  memo = Array.from(hooks.values()).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  return memo;
}
