// テスト用: 一時プロジェクト（src/features/_template と domain.json）を作り、生成器を関数として呼ぶ

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDomainContext } from "../domain/context.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { applyOutputs } from "../pipeline/apply.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * 一時プロジェクトを作る
 * @param {{ templates?: string[], domains?: string[], configs?: Record<string, object>, cleanup: string[] }} options
 *   templates = リポジトリの src/features/_template からコピーする相対パス、domains = リポジトリの domain.json をコピーするドメイン、
 *   configs = 直接書く domain.json（フォルダ名 → 内容）、cleanup = 作った一時ディレクトリを積む配列（after で消す）
 */
export function makeProject({ templates = [], domains = [], configs = {}, cleanup }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dc-test-"));
  cleanup.push(root);
  for (const rel of templates) {
    fs.cpSync(path.join(repoRoot, "src", "features", "_template", rel), path.join(root, "src", "features", "_template", rel), { recursive: true });
  }
  for (const domain of domains) {
    fs.mkdirSync(path.join(root, "src", "features", domain), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, "src", "features", domain, "domain.json"), path.join(root, "src", "features", domain, "domain.json"));
  }
  for (const [folder, config] of Object.entries(configs)) {
    fs.mkdirSync(path.join(root, "src", "features", folder), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "features", folder, "domain.json"), JSON.stringify(config));
  }
  return root;
}

/** 一時プロジェクトの workspace と domain context */
export function contextFor(root, domain) {
  const workspace = createWorkspace(root);
  return { workspace, ctx: createDomainContext(workspace, domain) };
}

/** Output を適用し、標準出力・警告を文字列で返す */
export function applyAndCapture(outputs) {
  const stdout = [];
  const stderr = [];
  applyOutputs(outputs, { log: (m) => stdout.push(m), warn: (m) => stderr.push(m) });
  return { stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}

export function removeAll(dirs) {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
}
