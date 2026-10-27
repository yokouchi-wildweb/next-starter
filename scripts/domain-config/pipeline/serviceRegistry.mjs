// src/registry/serviceRegistry.ts の作り直し（scripts/registry/serviceRegistry/generate.mjs を呼ぶ）。
// 全 domainEntry.ts から丸ごと生成する。失敗 = 他の domainEntry.ts や手書き行の不整合（メッセージの直し方に従う）

import { generateServiceRegistry } from "../../registry/serviceRegistry/generate.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {{ errorPrefix?: string }} [options] 失敗時のメッセージの接頭辞
 */
export function regenerateServiceRegistry(workspace, { errorPrefix = "" } = {}) {
  try {
    generateServiceRegistry(workspace.rootDir);
  } catch (error) {
    throw new Error(`${errorPrefix}${error instanceof Error ? error.message : String(error)}`);
  }
}
