// src/lib/crud/components/BulkActions/index.tsx
// よくある一括変更を、一括操作の受け口の項目(BulkActionItem)として数行で作る作成関数(棚の評議会 D149)。
// どれも今の Bulk*Button を包み、選択の ids を渡し、成功したら onDone(容器が選択の解除と再読み込み)を呼ぶ。
// 汎用の一括ボタンは副作用の無い列だけに使う。記録が必須の操作(状態の一括変更など)は上流の専用のサービス・API で出す

"use client";

import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { BulkBelongsToFieldButton, type BulkBelongsToFieldButtonProps } from "../Buttons/BulkBelongsToFieldButton";
import { BulkBelongsToManyFieldButton, type BulkBelongsToManyFieldButtonProps } from "../Buttons/BulkBelongsToManyFieldButton";
import { BulkDeleteButton, type BulkDeleteButtonProps } from "../Buttons/BulkDeleteButton";
import { BulkEnumFieldButton, type BulkEnumFieldButtonProps } from "../Buttons/BulkEnumFieldButton";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

/** ボタンの props のうち、作成関数が選択から埋める物を除いた残り */
type ButtonOptions<P> = Omit<P, "ids" | "onSuccess">;

function itemFrom<Row, Access, P extends { ids: string[]; onSuccess?: () => void; disabled?: boolean }>(
  meta: ItemMeta<Access>,
  options: ButtonOptions<P>,
  Button: (props: P) => React.ReactNode,
  displayName: string,
): BulkActionItem<Row, Access> {
  const Component = ({ selection, onDone }: BulkActionProps<Row>) => (
    <Button
      {...(options as P)}
      ids={selection.selectedIds}
      disabled={Boolean(options.disabled) || selection.count === 0}
      onSuccess={onDone}
    />
  );
  Component.displayName = `${displayName}(${meta.key})`;
  return { ...meta, Component };
}

/** 列挙型の列を一括で変える(BulkEnumFieldButton) */
export function bulkFieldAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: ButtonOptions<BulkEnumFieldButtonProps>,
): BulkActionItem<Row, Access> {
  return itemFrom<Row, Access, BulkEnumFieldButtonProps>(meta, options, BulkEnumFieldButton, "bulkFieldAction");
}

/** belongsTo の参照先を一括で変える(BulkBelongsToFieldButton) */
export function bulkBelongsToAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: ButtonOptions<BulkBelongsToFieldButtonProps>,
): BulkActionItem<Row, Access> {
  return itemFrom<Row, Access, BulkBelongsToFieldButtonProps>(meta, options, BulkBelongsToFieldButton, "bulkBelongsToAction");
}

/** belongsToMany の関連を一括で置き換える・足す(BulkBelongsToManyFieldButton。mode 既定 "replace") */
export function bulkRelationAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: ButtonOptions<BulkBelongsToManyFieldButtonProps>,
): BulkActionItem<Row, Access> {
  return itemFrom<Row, Access, BulkBelongsToManyFieldButtonProps>(meta, options, BulkBelongsToManyFieldButton, "bulkRelationAction");
}

/** 一括で削除する(BulkDeleteButton。汎用の bulk/delete-by-ids を開いているドメインだけ) */
export function bulkDeleteAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: ButtonOptions<BulkDeleteButtonProps>,
): BulkActionItem<Row, Access> {
  return itemFrom<Row, Access, BulkDeleteButtonProps>(meta, options, BulkDeleteButton, "bulkDeleteAction");
}
