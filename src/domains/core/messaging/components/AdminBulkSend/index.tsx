// src/domains/core/messaging/components/AdminBulkSend/index.tsx
// 管理一覧の一括操作「一括送信」の作成関数 bulkMessageAction(どのドメインの adminBulkActions の項目からも使う。D42)。
// @/lib/crud の bulk*Action と同じ形(meta + options → BulkActionItem)。lib は features を読めないので messaging に置く。
// 項目の部品 = 送るモーダル MessageSendModal を一括(bulk)の開き方で描く(宛先 = 選んだ記録、POST /api/admin/messaging/bulk-send、
// 門 messagingBroadcast の外。種別・レイアウトを選んで書き、テンプレートの読み込み・プレビュー・自分へのテスト送信が使える。予約は無い)。
// 決まった文面・カテゴリーは渡さない(それは連絡定義の物、D195 D200)。
// 対に要るもの: 持ち主のドメインの記録の宛先 <domain>/recordTargets/<名前>.ts(key = options.target = <ドメインのフォルダ名>.<ファイル名>。記録 → 宛先・afterSend)。
// 使い方: src/domains/core/messaging/components/README.md「管理一覧の一括送信（AdminBulkSend）」

"use client";

import { Mail } from "lucide-react";

import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { MessageSendModal } from "@/domains/core/messaging/components/MessageSendModal";
import type { AdminBulkSendResult } from "@/domains/core/messaging/services/client/adminMessagingClient";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

/** 作成関数の options */
export type BulkMessageActionOptions = {
  /** 記録の宛先の鍵(<ドメインのフォルダ名>.<ファイル名>。サーバーが記録 → 宛先を解く) */
  target: string;
  /** 記録の名詞(文に入る。例: "振込レビュー") */
  recordNoun: string;
  /** ボタンとモーダルの題(既定「一括送信」) */
  label?: string;
  /** 送り元(省略 = サーバーが "<target>.bulk") */
  source?: string;
  disabled?: boolean;
  /** 送った結果(任意) */
  onSent?: (result: AdminBulkSendResult) => void;
};

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
