// src/features/core/milestone/types/milestoneRenderer.ts

import type { ComponentType } from "react";

import type { PersistedMilestoneResult } from "./milestone";

/**
 * マイルストーンレンダラーに渡される props
 */
export type MilestoneRendererProps = {
  /** 描く結果(シリーズの鍵のレンダラーでは、その評価で達成した段のうち一番上の段) */
  result: PersistedMilestoneResult;
  /**
   * シリーズの鍵のレンダラーのとき: 同じシリーズでその評価に達成した段の結果の全部(下から = 評価の順)。
   * 段階の鍵・普通の定義の鍵のレンダラーでは undefined
   */
  seriesResults?: PersistedMilestoneResult[];
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
  /**
   * マイルストーンキー（マイルストーン定義の key と一致させる）。シリーズの鍵も書ける:
   * そのシリーズの段の結果を 1 つにまとめて描く(段階の鍵のレンダラーがあればそちらが勝つ)
   */
  key: string;
  /** 達成通知を描画するコンポーネント */
  component: ComponentType<MilestoneRendererProps>;
  /** 表示順（小さいほど先に表示。デフォルト: 0） */
  priority?: number;
  /** 表示モード（デフォルト: "inline"） */
  displayMode?: MilestoneDisplayMode;
};
