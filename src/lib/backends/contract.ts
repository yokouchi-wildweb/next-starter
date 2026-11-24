// src/lib/backends/contract.ts
// 契約テストの関数の形(D20 D33)。中身の契約は口ごと(口の持ち主が書く)。上流の実装・fake・フォークの実装が
// 自分のテストから同じ関数を流す。資格が要る場合に資格が無ければ未実施(skipped)と返す

import type { BackendAdapter } from "./types";

/** 契約の 1 件 */
export type BackendContractCase<A extends BackendAdapter, C> = {
  name: string;
  /** 資格(本物の鍵など)が要る件。資格が渡されなければ skipped */
  needsCredentials?: boolean;
  /** 確かめる。投げれば fail */
  run(adapter: A, context: { credentials?: C }): void | Promise<void>;
};

export type BackendContractResult = {
  name: string;
  status: "pass" | "fail" | "skipped";
  /** fail = 誤りの文、skipped = "no credentials" */
  reason?: string;
};

export type BackendContractReport = {
  port: string;
  results: BackendContractResult[];
};

export type BackendContract<A extends BackendAdapter, C> = {
  port: string;
  cases: readonly BackendContractCase<A, C>[];
  /** 全部の件を順に流し、件ごとの結果を返す(投げない) */
  run(adapter: A, options?: { credentials?: C }): Promise<BackendContractReport>;
};

/** 口の契約を定める。口の持ち主が ./node の入口から出し、各実装のテストが run を呼ぶ */
export function defineBackendContract<A extends BackendAdapter, C = unknown>(
  port: string,
  cases: readonly BackendContractCase<A, C>[],
): BackendContract<A, C> {
  return {
    port,
    cases,
    async run(adapter, options = {}) {
      const results: BackendContractResult[] = [];
      for (const item of cases) {
        if (item.needsCredentials && options.credentials === undefined) {
          results.push({ name: item.name, status: "skipped", reason: "no credentials" });
          continue;
        }
        try {
          await item.run(adapter, { credentials: options.credentials });
          results.push({ name: item.name, status: "pass" });
        } catch (error) {
          results.push({ name: item.name, status: "fail", reason: error instanceof Error ? error.message : String(error) });
        }
      }
      return { port, results };
    },
  };
}
