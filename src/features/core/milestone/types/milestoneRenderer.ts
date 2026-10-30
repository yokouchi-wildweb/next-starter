// src/features/core/milestone/types/milestoneRenderer.ts

import type { ComponentType } from "react";

import type { PersistedMilestoneResult } from "./milestone";

/**
 * マイルストーンレンダラーに渡される props
 */
export type MilestoneRendererProps = {
  result: PersistedMilestoneResult;
};

/**
 * レンダラーの表示モード
 * - inline: リスト内にインライン表示（デフォルト）
 * - modal: モーダルとして表示（ランクアップ演出等）
 */
export type MilestoneDisplayMode = "inline" | "modal";

/**
 * マイルストーンレンダラー定義
 */
export type MilestoneRendererDefinition = {
  /** マイルストーンキー（マイルストーン定義の key と一致させる） */
  key: string;
  /** 達成通知を描画するコンポーネント */
  component: ComponentType<MilestoneRendererProps>;
  /** 表示順（小さいほど先に表示。デフォルト: 0） */
  priority?: number;
  /** 表示モード（デフォルト: "inline"） */
  displayMode?: MilestoneDisplayMode;
};
