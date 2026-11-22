// src/features/core/messaging/components/DefinitionBulkAction/index.tsx
// 管理一覧の一括操作に定義連絡の汎用の送るモーダルを置く作成関数 definitionBulkAction(D194)。自由連絡の bulkMessageAction(AdminBulkSend)とは別。
// @/lib/crud の bulk*Action と同じ形(meta + options → BulkActionItem)。項目の部品 = DefinitionSendModal の記録の入口(宛先 = 選んだ記録、門の外)。
// 送る連絡定義は記録の宛先の項目の messages から選ぶ(1 つならそれ)。記録の名詞は項目の表示名。
// 対に要るもの: 持ち主のドメインの記録の宛先 <domain>/recordTargets/<名前>.ts(key = recordTarget、messages に送れる連絡定義)。
// 使い方: src/features/core/messaging/components/README.md「定義連絡の汎用のモーダル（DefinitionSendModal）」

"use client";

import { Mail } from "lucide-react";

import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { DefinitionSendModal } from "@/features/core/messaging/components/DefinitionSendModal";
import type { AdminDefinitionSendResult } from "@/features/core/messaging/services/client/definitionSendClient";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

/** 作成関数の options */
export type DefinitionBulkActionOptions = {
  /** 記録の宛先の鍵(<ドメインのフォルダ名>.<ファイル名>) */
  recordTarget: string;
  /** ボタンとモーダルの題(既定「連絡を送る」) */
  label?: string;
  disabled?: boolean;
  /** 送った結果(任意) */
  onSent?: (result: AdminDefinitionSendResult) => void;
};

/** 選んだ記録に紐づく利用者へ連絡定義を送る(汎用の送るモーダルの記録の入口) */
export function definitionBulkAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: DefinitionBulkActionOptions,
): BulkActionItem<Row, Access> {
  const Component = ({ selection, onDone }: BulkActionProps<Row>) => (
    <DefinitionSendModal
      entry={{ type: "records", recordTarget: options.recordTarget, recordIds: selection.selectedIds }}
      label={options.label}
      icon={<Mail className="size-4" />}
      disabled={Boolean(options.disabled) || selection.count === 0}
      onSent={(result) => {
        options.onSent?.(result);
        onDone();
      }}
    />
  );
  Component.displayName = `definitionBulkAction(${meta.key})`;
  return { ...meta, Component };
}
