// テスト用: 一時プロジェクト（src/domains/_template と宣言 domain.json + entities/<登録名>/entity.json）を作り、生成器を関数として呼ぶ

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDomainContext } from "../domain/context.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { applyOutputs } from "../pipeline/apply.mjs";
import { TYPES_MODULE } from "../render/registry/domainEntry.mjs";
import { PRESET_MODULE } from "../render/registry/presetAccess.mjs";
import { copyBySpecifiers } from "../../../runner/test/lib.copyByImports.mjs";
import { DOMAIN_DECLARATION_VERSION } from "../../../../src/lib/domain/node.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * 一時プロジェクトを作る
 * @param {{ templates?: string[], domains?: string[], configs?: Record<string, object>, cleanup: string[] }} options
 *   templates = リポジトリの src/domains/_template からコピーする相対パス、domains = リポジトリの宣言(domain.json と主の登録の entity.json)をコピーするドメイン、
 *   configs = 直接書く宣言（フォルダ名 → 主の登録の entity.json の内容。writeDeclaration）、cleanup = 作った一時ディレクトリを積む配列（after で消す）
 */
export function makeProject({ templates = [], domains = [], configs = {}, cleanup }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dc-test-"));
  cleanup.push(root);
  for (const rel of templates) {
    fs.cpSync(path.join(repoRoot, "src", "domains", "_template", rel), path.join(root, "src", "domains", "_template", rel), { recursive: true });
  }
  for (const domain of domains) {
    // リポジトリの宣言(domain.json と主の登録 entities/<domain>/entity.json)を写す
    const from = path.join(repoRoot, "src", "domains", domain);
    const to = path.join(root, "src", "domains", domain);
    fs.mkdirSync(path.join(to, "entities", domain), { recursive: true });
    fs.copyFileSync(path.join(from, "domain.json"), path.join(to, "domain.json"));
    fs.copyFileSync(path.join(from, "entities", domain, "entity.json"), path.join(to, "entities", domain, "entity.json"));
  }
  for (const [folder, config] of Object.entries(configs)) writeDeclaration(root, folder, config);
  return root;
}

/**
 * 1 表のドメインの宣言を書く: config(表の鍵・登録の鍵。domainConfigVersion は持たなくてよい)を主の登録の entities/<名前>/entity.json に、
 * label を domain.json に。folder = src/domains からの相対(core/<名前> も可)。登録名 = フォルダ名の最後
 * @param {string} root
 * @param {string} folder
 * @param {object} config
 */
export function writeDeclaration(root, folder, config) {
  const dir = path.join(root, "src", "domains", folder);
  const registration = path.basename(folder);
  const { domainConfigVersion: _version, ...entity } = config;
  fs.mkdirSync(path.join(dir, "entities", registration), { recursive: true });
  fs.writeFileSync(path.join(dir, "domain.json"), JSON.stringify({ domainConfigVersion: DOMAIN_DECLARATION_VERSION, ...(config.label !== undefined ? { label: config.label } : {}) }));
  fs.writeFileSync(path.join(dir, "entities", registration, "entity.json"), JSON.stringify(entity));
}

/** 主の登録の entity.json の場所(テストが書き換える時) */
export const entityDeclarationPath = (root, folder) => path.join(root, "src", "domains", folder, "entities", path.basename(folder), "entity.json");

/**
 * 登録表の検査(domainEntry の静的 import の決まり)が読む物を一時プロジェクトへ写す:
 * tsconfig.json(@/ の paths、データ)と、生成される domainEntry.ts が import する先(生成器の定数 TYPES_MODULE・PRESET_MODULE)から
 * import で届くファイル(copyBySpecifiers。置き場が動いても直さずに済む)
 */
export async function copyRegistryBase(root) {
  await copyBySpecifiers({ from: repoRoot, to: root, specifiers: [TYPES_MODULE, PRESET_MODULE], data: ["tsconfig.json"] });
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
