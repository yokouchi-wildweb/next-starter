// マイルストーン達成通知のクライアント側レンダラーレジストリ
//
// サーバー側の registerMilestone と対称的に、
// 下流プロジェクトが達成通知のUIコンポーネントを登録できる。
//
// 使い方（下流プロジェクト）:
// ```ts
// import { registerMilestoneRenderer } from "@/features/core/milestone/components/milestoneRendererRegistry";
//
// registerMilestoneRenderer({
//   key: "first_purchase",
//   component: FirstPurchaseCelebration,
//   priority: 10,
// });
// ```
//
// 登録されたレンダラーは PurchaseComplete コンポーネント内で自動的に描画される。
// 未登録のマイルストーンにはデフォルトの達成通知が表示される。

import type { ComponentType } from "react";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";

/**
 * マイルストーンレンダラーに渡される props
 */
export type MilestoneRendererProps = {
  result: PersistedMilestoneResult;
};

/**
 * マイルストーンレンダラー定義
 */
export type MilestoneRendererDefinition = {
  /** マイルストーンキー（registerMilestone の key と一致させる） */
  key: string;
  /** 達成通知を描画するコンポーネント */
  component: ComponentType<MilestoneRendererProps>;
  /** 表示順（小さいほど先に表示。デフォルト: 0） */
  priority?: number;
};

const renderers = new Map<string, MilestoneRendererDefinition>();

/**
 * マイルストーンレンダラーを登録する
 *
 * 同じキーで再登録すると上書きされる。
 */
export function registerMilestoneRenderer(definition: MilestoneRendererDefinition): void {
  renderers.set(definition.key, definition);
}

/**
 * 登録済みの全レンダラーを priority 昇順で取得する
 */
export function getMilestoneRenderers(): MilestoneRendererDefinition[] {
  return Array.from(renderers.values()).sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
  );
}

/**
 * 指定キーのレンダラーを取得する
 */
export function getMilestoneRenderer(key: string): MilestoneRendererDefinition | undefined {
  return renderers.get(key);
}
