// src/features/core/messaging/components/AdminBulkSend/index.tsx
// 管理一覧の一括操作「一括送信」の作成関数 bulkMessageAction(どのドメインの adminBulkActions の項目からも使う。D42)。
// @/lib/crud/components の bulk*Action と同じ形(meta + options → BulkActionItem)。lib は features を読めないので messaging に置く。
// 対に要るもの: サーバーの受け口 messaging/bulkSendTargets/<名前>.ts(key = options.target。記録 → 利用者 id・afterSend)。
// 使い方: src/features/core/messaging/README.md「管理の画面と一括送信の作成関数」

"use client";

import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { AdminBulkSendButton, type AdminBulkSendButtonProps } from "./AdminBulkSendButton";

export { AdminBulkSendButton };
export type { AdminBulkSendButtonProps, AdminBulkSendDefaults, AdminBulkSendKind } from "./AdminBulkSendButton";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

/** ボタンの props のうち、作成関数が選択から埋める物を除いた残り */
export type BulkMessageActionOptions = Omit<AdminBulkSendButtonProps, "ids" | "onSuccess">;

/** 選んだ記録に紐づく利用者へ連絡を一括で送る(AdminBulkSendButton) */
export function bulkMessageAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: BulkMessageActionOptions,
): BulkActionItem<Row, Access> {
  const Component = ({ selection, onDone }: BulkActionProps<Row>) => (
    <AdminBulkSendButton
      {...options}
      ids={selection.selectedIds}
      disabled={Boolean(options.disabled) || selection.count === 0}
      onSuccess={onDone}
    />
  );
  Component.displayName = `bulkMessageAction(${meta.key})`;
  return { ...meta, Component };
}
