// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/importRun.ts
// インポートの進め方（純関数。チャンクの送信は呼び出し側が渡す）。
// - ドメインは related → main → hasMany → junction の順に、チャンクは 1 から順に 1 つずつ流す
// - チャンクは 1 つずつ別の TX で書かれるので、失敗した時点で前のチャンクは DB に入っている。失敗したらそこで全体を止め、
//   後のチャンク（同じドメインの残りと、後に続くドメイン = 親の行を前提にするもの）は流さない
// - 止まったら、入ったもの（committed）と入っていないもの（失敗したチャンク + 流さなかったチャンク）を結果に分けて返す
// - チャンクは upsert なので、原因を直して同じファイルを取り込み直せば続きから揃う

import type { ChunkResult, DomainImportResult, ImportDomainType, NotRunChunk } from "../../types";

/** 取り込む 1 ドメイン分 */
export type ImportStep = {
  /** ドメイン名 */
  name: string;
  /** ドメインの種類（v1.0 は main） */
  type: ImportDomainType;
  /** チャンク数 */
  chunkCount: number;
  /** ZIP の中のチャンクの置き場（v1.0 は ""） */
  chunkPrefix: string;
};

/** 1 チャンクを処理する関数（成功・失敗を ChunkResult で返す。投げない） */
export type ProcessChunk = (step: ImportStep, chunkIndex: number, stepIndex: number) => Promise<ChunkResult>;

/** インポートを進めた結果 */
export type ImportRunOutcome = {
  totalRecords: number;
  successfulChunks: number;
  failedChunks: number;
  chunkResults: ChunkResult[];
  domainResults: DomainImportResult[];
  /** 止まった原因のチャンク（全部成功なら null） */
  stoppedAt: ChunkResult | null;
  /** 止まったために流さなかったチャンク（流した順） */
  notRunChunks: NotRunChunk[];
};

/** ドメインの処理順（related → main → hasMany → junction） */
const TYPE_ORDER: Record<ImportDomainType, number> = { related: 1, main: 2, hasMany: 3, junction: 4 };

/** ZIP の中のチャンク名（0 始まりの番号 → chunk_001） */
export function chunkNameOf(chunkIndex: number): string {
  return `chunk_${String(chunkIndex + 1).padStart(3, "0")}`;
}

/** ドメインを処理順に並べる（同じ種類はマニフェストの順のまま） */
export function sortImportSteps<T extends { type: string }>(steps: readonly T[]): T[] {
  const orderOf = (type: string) => TYPE_ORDER[type as ImportDomainType] ?? 99;
  return [...steps].sort((a, b) => orderOf(a.type) - orderOf(b.type));
}

/**
 * ドメインを渡された順に、チャンクを 1 つずつ処理する。最初に失敗したチャンクで止め、残りは notRunChunks に入れる
 * @param steps 処理順に並べたドメイン（sortImportSteps）
 * @param processChunk 1 チャンクの処理
 */
export async function runImportSteps(steps: readonly ImportStep[], processChunk: ProcessChunk): Promise<ImportRunOutcome> {
  const chunkResults: ChunkResult[] = [];
  const domainResults: DomainImportResult[] = [];
  const notRunChunks: NotRunChunk[] = [];
  let stoppedAt: ChunkResult | null = null;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    const domainResult: DomainImportResult = { domain: step.name, totalRecords: 0, successfulChunks: 0, failedChunks: 0 };
    domainResults.push(domainResult);

    for (let chunkIndex = 0; chunkIndex < step.chunkCount; chunkIndex++) {
      if (stoppedAt) {
        notRunChunks.push({ domain: step.name, chunkName: chunkNameOf(chunkIndex) });
        continue;
      }
      const result = await processChunk(step, chunkIndex, stepIndex);
      chunkResults.push(result);
      if (result.success) {
        domainResult.totalRecords += result.recordCount;
        domainResult.successfulChunks++;
      } else {
        domainResult.failedChunks++;
        stoppedAt = result;
      }
    }
  }

  return {
    totalRecords: domainResults.reduce((sum, d) => sum + d.totalRecords, 0),
    successfulChunks: domainResults.reduce((sum, d) => sum + d.successfulChunks, 0),
    failedChunks: domainResults.reduce((sum, d) => sum + d.failedChunks, 0),
    chunkResults,
    domainResults,
    stoppedAt,
    notRunChunks,
  };
}
