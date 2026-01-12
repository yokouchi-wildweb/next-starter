/**
 * ウォレット履歴表示用のユーティリティ関数
 */

import type { ReactElement } from "react";
import type { WalletHistoryBatchSummarySerialized } from "@/features/core/walletHistory/types/batch";
import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type { DetailModalRow } from "@/components/Overlays/DetailModal/types";
import {
  WalletHistoryChangeMethodOptions,
  WalletHistorySourceTypeOptions,
} from "@/features/core/walletHistory/constants/field";
import { getMetaFieldLabelMap } from "@/features/core/wallet/utils/currency";
import { formatNumber, formatMetaValue } from "./formatters";

// ラベルマップの作成
const methodLabelMap = new Map(
  WalletHistoryChangeMethodOptions.map((option) => [option.value, option.label]),
);
const sourceLabelMap = new Map(
  WalletHistorySourceTypeOptions.map((option) => [option.value, option.label]),
);
const metaFieldLabelMap = getMetaFieldLabelMap();

/**
 * バッチ処理の差分サマリーをフォーマット
 */
export function formatDeltaSummary(history: WalletHistoryBatchSummarySerialized): string {
  if (history.changeMethods.length === 1 && history.changeMethods[0] === "SET") {
    return `残高を ${formatNumber(history.balanceAfter)} に設定`;
  }
  const sign = history.totalDelta < 0 ? "-" : "+";
  return `${sign}${formatNumber(Math.abs(history.totalDelta))} pt`;
}

/**
 * 残高変更後の色クラスを返す
 */
export function formatBalanceClass(history: WalletHistoryBatchSummarySerialized): string {
  if (history.changeMethods.includes("SET")) {
    return "text-blue-600";
  }
  if (history.totalDelta < 0) {
    return "text-red-600";
  }
  return "text-emerald-600";
}

/**
 * 変更メソッドのラベルをフォーマット
 */
export function formatChangeMethodLabel(history: WalletHistoryBatchSummarySerialized): string {
  if (history.changeMethods.length === 1) {
    const method = history.changeMethods[0]!;
    return methodLabelMap.get(method) ?? method;
  }
  return "複数の操作";
}

/**
 * ソース種別をフォーマット
 */
export function formatSourceTypes(history: WalletHistoryBatchSummarySerialized): string {
  if (history.sourceTypes.length === 1) {
    const source = history.sourceTypes[0]!;
    return sourceLabelMap.get(source) ?? source;
  }
  return "複数";
}

/**
 * 個別レコードの差分をフォーマット
 */
export function formatDeltaRecord(record: WalletHistory): string {
  if (record.change_method === "SET") {
    return `残高を ${formatNumber(record.balance_after)} に設定`;
  }
  const sign = record.change_method === "DECREMENT" ? "-" : "+";
  return `${sign}${formatNumber(record.points_delta)} pt`;
}

/**
 * バッチから理由のリストを抽出（重複除去）
 */
export function extractReasons(history: WalletHistoryBatchSummarySerialized): string[] {
  const reasons = history.records
    .map((record) => record.reason?.trim())
    .filter((reason): reason is string => Boolean(reason));
  return Array.from(new Set(reasons));
}

/**
 * バッチからメタ情報の行を抽出
 */
export function extractMetaRows(history: WalletHistoryBatchSummarySerialized): DetailModalRow[] {
  const metaMap = new Map<string, Set<string>>();

  history.records.forEach((record) => {
    const meta = record.meta;
    if (!meta) return;
    Object.entries(meta).forEach(([key, value]) => {
      if (!metaMap.has(key)) {
        metaMap.set(key, new Set());
      }
      metaMap.get(key)!.add(formatMetaValue(value));
    });
  });

  if (!metaMap.size) {
    return [[{ label: "メタ情報", value: "メタ情報は設定されていません" }]];
  }

  return Array.from(metaMap.entries()).map(([key, values]) => [
    {
      label: metaFieldLabelMap.get(key) ?? key,
      value: renderValueList(Array.from(values)),
    },
  ]);
}

/**
 * 値のリストをJSXでレンダリング
 */
export function renderValueList(values: string[]): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

/**
 * 変更メソッドのラベルマップを取得
 */
export function getMethodLabelMap(): Map<string, string> {
  return methodLabelMap;
}
