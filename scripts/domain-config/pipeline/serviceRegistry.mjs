// src/registry/serviceRegistry.ts の作り直し（scripts/registry/serviceRegistry/generate.mjs を呼ぶ）と、書く前の検査。
// 登録表は全 domainEntry.ts から丸ごと生成する。失敗 = 他の domainEntry.ts や手書き行の不整合（メッセージの直し方に従う）。
// 検査は「これから書くファイル」を重ねた見え方で行うので、書いてから壊れていたと分かることがない

import { createOverlayView } from "../../registry/serviceRegistry/discover.mjs";
import { buildServiceRegistry, formatRegistryErrors, generateServiceRegistry } from "../../registry/serviceRegistry/generate.mjs";

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

/**
 * Output から「書いた後のファイルの見え方」を作る。file は新しい内容、writeOnce は無いときだけ新しい内容
 * @param {import("../render/output.mjs").Output[]} outputs
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @returns {Map<string, string | null>}
 */
export function overlayFromOutputs(outputs, workspace) {
  const overlay = new Map();
  for (const out of outputs) {
    if (out.kind === "file") overlay.set(out.path, out.content);
    else if (out.kind === "writeOnce" && !workspace.exists(out.path)) overlay.set(out.path, out.content);
  }
  return overlay;
}

/**
 * 書く前に、書いた後の状態で serviceRegistry.ts が作れるかを検査する。作れなければ例外（何も書かれない）
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {import("../render/output.mjs").Output[]} outputs これから書く Output（複数ドメイン分をまとめて渡してよい）
 * @param {{ errorPrefix?: string }} [options]
 */
export function precheckServiceRegistry(workspace, outputs, { errorPrefix = "" } = {}) {
  const { errors } = buildServiceRegistry(workspace.rootDir, { view: createOverlayView(overlayFromOutputs(outputs, workspace)) });
  if (errors.length > 0) {
    throw new Error(`${errorPrefix}${formatRegistryErrors(errors)}`);
  }
}
