// src/lib/tableSuite/BulkActions/types.ts
// 管理一覧の一括操作の項目の型(受け口の項目 1 つ = 部品 1 つ。棚の評議会 D149)

import type { ComponentType } from "react";

import type { BulkActionSelection } from "../RecordSelectionTable/components/BulkActionBar";

/** 項目の部品が受け取るもの */
export type BulkActionProps<Row> = {
  /** 今の選択(selectedIds・selectedRows・count・clear) */
  selection: BulkActionSelection<Row>;
  /** 操作が終わったら呼ぶ(容器が選択の解除と一覧の再読み込みをする) */
  onDone: () => void;
};

/**
 * 一括操作の項目。受け口のフォルダに 1 項目 1 ファイルで置く(export const bulkAction)。
 * - key: 項目の一意の名前(同じ受け口で重複すると例外)。.override で enabled・order を変えるときの宛先
 * - lists: 出す一覧の名前(省略 = その受け口の全部の一覧)。user なら "general" / "managerial" / "demo"
 * - enabled: false か false を返す関数で出さない(機能の設定に従うときは関数にする)
 * - order: 並び(小さい順。同じなら key の順。省略 = 100)
 * - access: 表示の出し分けに使う値。中身は lib では見ず、容器が渡す述語 can で判定する(権限の守りは API の側)
 */
export type BulkActionItem<Row, Access = unknown> = {
  key: string;
  Component: ComponentType<BulkActionProps<Row>>;
  lists?: readonly string[];
  enabled?: boolean | (() => boolean);
  order?: number;
  access?: Access;
};

export type SelectBulkActionsOptions<Access> = {
  /** 容器の一覧の名前(項目の lists と照らす。省略 = lists を持つ項目は出さない) */
  list?: string;
  /** access を持つ項目を出してよいか(省略 = access を持つ項目は出さない = 安全側) */
  can?: (access: Access) => boolean;
};
