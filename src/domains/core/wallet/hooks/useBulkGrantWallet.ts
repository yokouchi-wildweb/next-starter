// src/domains/core/wallet/hooks/useBulkGrantWallet.ts

"use client";

import { useDomainMutation } from "@/lib/crud";
import { userConfig } from "@/domains/user/config";
import { runInChunks } from "@/utils/runInChunks";

import { walletClient } from "../services/client/walletClient";
import type { BulkGrantParams } from "../services/types";
import { mergeBulkGrantResults, type BulkGrantRunResult } from "../utils/bulkGrantChunks";

/**
 * 選んだ利用者へのまとめての付与・補填(管理者操作、POST /api/admin/wallet/bulk/grant = 運用コマンド wallet:bulk-grant と同じ関数)。
 * - trigger(params): grants を 1 回の上限(userConfig.bulkUpdate.maxIds、既定 1000)ずつの束に分けて順に送り、結果をまとめて返す
 *   (束ごとに request_batch_id が分かれる → 結果の requestBatchIds)。dryRun: true も同じ分け方で、何も書かずに人数・合計・飛ばす人を返す
 * - 途中の束で失敗したらそこで止め、ChunkRunError(@/utils/runInChunks)を投げる: doneChunks / totalChunks = 何束目まで済んだか、
 *   results = 済んだ束の API の結果(書いた束の requestBatchId を含む。mergeBulkGrantResults でまとめられる)。済んだ束は戻さない
 * - 画面は dryRun → 確かめ → 本番の順に呼ぶ。上流は画面を作らない(D304)
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 */
export const useBulkGrantWallet = () =>
  useDomainMutation<BulkGrantRunResult, BulkGrantParams>(
    "wallet-bulk-grant",
    async (params) => {
      const results = await runInChunks(params.grants, userConfig.bulkUpdate.maxIds, (grants) =>
        walletClient.bulkGrant({ ...params, grants }),
      );
      return mergeBulkGrantResults(results, params.dryRun ?? false);
    },
    "wallets",
  );
