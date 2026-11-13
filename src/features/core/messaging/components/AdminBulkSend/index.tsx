// src/features/core/messaging/components/AdminBulkSend/index.tsx
// 管理一覧の一括操作「一括送信」の作成関数 bulkMessageAction(どのドメインの adminBulkActions の項目からも使う。D42)。
// @/lib/crud/components の bulk*Action と同じ形(meta + options → BulkActionItem)。lib は features を読めないので messaging に置く。
// 項目の部品 = 送るモーダル MessageSendModal を一括(bulk)の開き方で描く(宛先 = 選んだ記録、POST /api/admin/messaging/bulk-send、
// 門 messagingBroadcast の外。テンプレートの呼び出し・プレビュー・自分へのテスト送信が使える。予約は無い)。
// 対に要るもの: サーバーの受け口 messaging/bulkSendTargets/<名前>.ts(key = options.target。記録 → 利用者 id・afterSend)。
// 使い方: src/features/core/messaging/README.md「管理一覧の一括送信の作成関数」

"use client";

import { Mail } from "lucide-react";

import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { MessageSendModal } from "@/features/core/messaging/components/MessageSendModal";
import type { MessageSendDefaults } from "@/features/core/messaging/hooks/useMessageSendModal";
import type { AdminBulkSendResult } from "@/features/core/messaging/services/client/adminMessagingClient";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

/** 作成関数の options */
export type BulkMessageActionOptions = {
  /** 受け口 bulkSendTargets の項目の鍵(サーバーが記録 → 利用者を解く) */
  target: string;
  /** 記録の名詞(文に入る。例: "振込レビュー") */
  recordNoun: string;
  /** ボタンとモーダルの題(既定「一括送信」) */
  label?: string;
  /** 書く欄の初期値 */
  defaults?: MessageSendDefaults;
  /** 既定のカテゴリー(既定 operatorDirect。選べなければ最初) */
  defaultCategory?: string;
  /** 送り元(省略 = サーバーが "<target>.bulk") */
  source?: string;
  disabled?: boolean;
  /** 送った結果(任意) */
  onSent?: (result: AdminBulkSendResult) => void;
};

export type { MessageSendDefaults as AdminBulkSendDefaults };

/** 選んだ記録に紐づく利用者へ連絡を一括で送る(送るモーダルの bulk) */
export function bulkMessageAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: BulkMessageActionOptions,
): BulkActionItem<Row, Access> {
  const Component = ({ selection, onDone }: BulkActionProps<Row>) => (
    <MessageSendModal
      mode={{
        type: "bulk",
        target: options.target,
        recordIds: selection.selectedIds,
        recordNoun: options.recordNoun,
        defaults: options.defaults,
        defaultCategory: options.defaultCategory,
        source: options.source,
      }}
      label={options.label ?? "一括送信"}
      icon={<Mail className="size-4" />}
      disabled={Boolean(options.disabled) || selection.count === 0}
      onSent={(sent) => {
        if (sent.kind === "bulk") options.onSent?.(sent.result);
        onDone();
      }}
    />
  );
  Component.displayName = `bulkMessageAction(${meta.key})`;
  return { ...meta, Component };
}
