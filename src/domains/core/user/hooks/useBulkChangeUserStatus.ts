// src/domains/core/user/hooks/useBulkChangeUserStatus.ts

"use client";

import { useDomainMutation } from "@/lib/crud";
import { userConfig } from "@/domains/user/config";
import { runInChunks } from "@/utils/runInChunks";

import { userClient } from "../services/client/userClient";
import type { BulkChangeStatusParams, BulkChangeStatusResult } from "../types";
import { mergeBulkStatusResults } from "../utils/bulkStatusChunks";

/**
 * 選んだ利用者の状態のまとめての変更(管理者操作、POST /api/admin/user/bulk/status = 運用コマンド user:bulk-change-status と同じ関数)。
 * - trigger(params): userIds を 1 回の上限(userConfig.bulkUpdate.maxIds、既定 1000)ずつの束に分けて順に送り、結果をまとめて返す(形は API と同じ)。
 *   dryRun: true も同じ分け方で、何も書かずに変える人・飛ばす人を返す
 * - 途中の束で失敗したらそこで止め、ChunkRunError(@/utils/runInChunks)を投げる: doneChunks / totalChunks = 何束目まで済んだか、
 *   results = 済んだ束の API の結果(mergeBulkStatusResults でまとめられる)。済んだ束は戻さない(打ち直すと変わった人は飛ばされる)
 * - 画面は dryRun → 確かめ → 本番の順に呼ぶ。上流は画面を作らない(D304)
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 * 成功時: users 一覧・検索キャッシュを再検証
 */
export const useBulkChangeUserStatus = () =>
  useDomainMutation<BulkChangeStatusResult, BulkChangeStatusParams>(
    "users/bulk-change-status",
    async (params) => {
      const results = await runInChunks(params.userIds, userConfig.bulkUpdate.maxIds, (userIds) =>
        userClient.bulkChangeStatus({ ...params, userIds }),
      );
      return mergeBulkStatusResults(results, params.dryRun ?? false);
    },
    "users",
  );
