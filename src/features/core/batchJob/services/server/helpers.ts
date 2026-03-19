// src/features/core/batchJob/services/server/helpers.ts

import { batchJobService } from "./batchJobService";
import type { BatchJob } from "@/features/batchJob/types";

type CreateJobFromQueryDefinition<TParams> = {
  jobType: string;
  jobKey: string;
  params: TParams;
  batchSize?: number;
  targetQuery?: unknown;
};

/**
 * 検索条件から対象IDを解決してバッチジョブを作成するヘルパー。
 * target_query にメタデータとして条件を記録する（実行には不使用）。
 */
export async function createJobFromQuery<TParams>(
  definition: CreateJobFromQueryDefinition<TParams>,
  resolveItems: () => Promise<string[]>,
): Promise<BatchJob> {
  const itemKeys = await resolveItems();

  return batchJobService.createJob({
    jobType: definition.jobType,
    jobKey: definition.jobKey,
    params: definition.params,
    itemKeys,
    batchSize: definition.batchSize,
    targetQuery: definition.targetQuery,
  });
}
