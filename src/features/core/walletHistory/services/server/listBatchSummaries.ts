// src/features/core/walletHistory/services/server/listBatchSummaries.ts

import type { WalletHistory } from "@/features/core/walletHistory/entities";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type { WalletHistoryBatchSummary } from "@/features/core/walletHistory/types/batch";
import { db } from "@/lib/drizzle";
import { desc, eq } from "drizzle-orm";

export type ListBatchSummariesParams = {
  userId: string;
  limit?: number;
  page?: number;
};

export async function listBatchSummaries({
  userId,
  limit = 20,
  page = 1,
}: ListBatchSummariesParams): Promise<{ items: WalletHistoryBatchSummary[]; total: number }> {
  const resolvedLimit = Math.max(limit, 1);
  const resolvedPage = Math.max(page, 1);
  const offset = (resolvedPage - 1) * resolvedLimit;

  const records = await db
    .select()
    .from(WalletHistoryTable)
    .where(eq(WalletHistoryTable.user_id, userId))
    .orderBy(desc(WalletHistoryTable.createdAt));

  if (!records.length) {
    return { items: [], total: 0 };
  }

  const grouped = groupHistories(records);
  const total = grouped.length;
  const paged = grouped.slice(offset, offset + resolvedLimit);

  return { items: paged, total };
}

function groupHistories(records: WalletHistory[]): WalletHistoryBatchSummary[] {
  const map = new Map<string, WalletHistory[]>();
  records.forEach((record) => {
    const key = record.request_batch_id ?? record.id;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(record);
  });

  return Array.from(map.entries())
    .map(([batchId, batchRecords]) => buildBatchSummary(batchId, batchRecords))
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

function buildBatchSummary(batchId: string, records: WalletHistory[]): WalletHistoryBatchSummary {
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  );
  const first = sortedRecords[0]!;
  const last = sortedRecords[sortedRecords.length - 1]!;

  return {
    batchId,
    requestBatchId: first.request_batch_id ?? null,
    userId: first.user_id,
    type: first.type,
    startedAt: new Date(first.createdAt ?? new Date()),
    completedAt: new Date(last.createdAt ?? new Date()),
    balanceBefore: Math.min(...sortedRecords.map((record) => record.balance_before ?? 0)),
    balanceAfter: Math.max(...sortedRecords.map((record) => record.balance_after ?? 0)),
    totalDelta: sortedRecords.reduce((sum, record) => sum + resolveSignedDelta(record), 0),
    changeMethods: Array.from(new Set(sortedRecords.map((record) => record.change_method))),
    sourceTypes: Array.from(new Set(sortedRecords.map((record) => record.source_type))),
    records: sortedRecords.sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    ),
  };
}

function resolveSignedDelta(record: WalletHistory) {
  if (record.change_method === "DECREMENT") {
    return -record.points_delta;
  }
  if (record.change_method === "SET") {
    return (record.balance_after ?? 0) - (record.balance_before ?? 0);
  }
  return record.points_delta;
}
