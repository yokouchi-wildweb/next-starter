// dc:delete のレジストリ掃除: adminDataMenu / schemaRegistry / domainConfigRegistry の該当行、storagePurposeRegistry の AUTO エントリ、
// serviceRegistry.ts の作り直し。失敗してもディレクトリ削除は済んでいるため止めず、failures に積んで最後に報告する

import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toKebabCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { removeObjectEntry } from "../../text/objectEntry.mjs";
import { removeStoragePurposesText } from "../../render/registry/storagePurpose/index.mjs";
import { regenerateServiceRegistry } from "../serviceRegistry.mjs";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeLineContaining(filePath, keyword, io) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  fs.writeFileSync(filePath, lines.filter((l) => !l.includes(keyword)).join("\n"));
  io.log(`更新しました: ${filePath}`);
}

/** レジストリのオブジェクト直下から key のエントリを丸ごと削除する（複数行可・キー完全一致） */
function removeRegistryEntry(rootDir, filePath, objectName, key, failures, io) {
  if (!fs.existsSync(filePath)) return;
  try {
    const { text, removed } = removeObjectEntry(fs.readFileSync(filePath, "utf8"), { objectName, key });
    if (!removed) return;
    fs.writeFileSync(filePath, text);
    io.log(`更新しました: ${filePath}`);
  } catch (err) {
    failures.push(`${path.relative(rootDir, filePath)}: ${objectName}.${key} を削除できませんでした（${err.message}）`);
  }
}

function removeLinesByHref(filePath, hrefs, io) {
  if (!fs.existsSync(filePath)) return;
  const hrefSet = new Set(hrefs.filter(Boolean));
  if (hrefSet.size === 0) return;
  const patterns = [...hrefSet].map((href) => new RegExp(`href:\\s*["']${escapeRegExp(href)}["']`));
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const filtered = lines.filter((line) => !patterns.some((pattern) => pattern.test(line)));
  if (filtered.length === lines.length) return;
  fs.writeFileSync(filePath, filtered.join("\n"));
  io.log(`更新しました: ${filePath}`);
}

/** 管理メニューの href 候補（/admin/<kebab> の揺れを全部） */
function menuHrefCandidates(pluralKebab, plural, pluralCandidateSet) {
  const expanded = new Set();
  for (const candidate of new Set([pluralKebab, plural, ...pluralCandidateSet])) {
    if (!candidate) continue;
    expanded.add(candidate);
    expanded.add(toKebabCase(candidate));
  }
  const hrefs = [];
  for (const candidate of expanded) {
    if (!candidate) continue;
    if (candidate.startsWith("/")) hrefs.push(candidate);
    else if (candidate.startsWith("admin/")) hrefs.push(`/${candidate}`);
    else hrefs.push(`/admin/${candidate}`);
  }
  return hrefs;
}

/**
 * @returns {string[]} 自動で直せなかったレジストリ（手で直す案内）
 */
export function cleanupRegistries(workspace, { pluralKebab, plural, pluralCandidateSet, featureCandidateSet, canonicalSingular, camel, normalizedSnake }, io = console) {
  const { rootDir } = workspace;
  removeLinesByHref(workspace.registryPath("adminDataMenu.ts"), menuHrefCandidates(pluralKebab, plural, pluralCandidateSet), io);

  const schemaPath = workspace.registryPath("schemaRegistry.ts");
  for (const candidate of featureCandidateSet) {
    removeLineContaining(schemaPath, `@/features/${candidate}/entities/drizzle`, io);
  }

  // レジストリのエントリは、実在したドメインディレクトリ名（無ければ入力の camelCase）から決めたキーだけを消す。
  // 候補名（単数形推定など）を広く使うと、別ドメインのエントリを消しかねないため
  const registryCamel = toCamelCase(canonicalSingular) || camel;
  const registrySnake = toSnakeCase(registryCamel) || normalizedSnake;
  const failures = [];

  // serviceRegistry.ts は domainEntry.ts（ドメインのフォルダごと消えた）から丸ごと作り直す
  try {
    regenerateServiceRegistry(workspace);
  } catch (err) {
    failures.push(`src/registry/serviceRegistry.ts: 再生成できませんでした（${err.message}）`);
  }

  const domainConfigPath = workspace.registryPath("domainConfigRegistry.ts");
  for (const candidate of featureCandidateSet) {
    removeLineContaining(domainConfigPath, `@/features/${candidate}/domain.json`, io);
  }
  removeRegistryEntry(rootDir, domainConfigPath, "domainConfigMap", registrySnake, failures, io);

  // ファイル用途（AUTO ブロックのうち <domain>.* だけ。手書きの FORK 定義は残す）
  const purposePath = workspace.registryPath("storagePurposeRegistry.ts");
  try {
    if (fs.existsSync(purposePath)) {
      const after = removeStoragePurposesText(fs.readFileSync(purposePath, "utf8"), registryCamel);
      if (after !== null) {
        fs.writeFileSync(purposePath, after);
        io.log(`更新しました: ${purposePath}`);
      }
    }
  } catch (err) {
    failures.push(`src/registry/storagePurposeRegistry.ts: ${registryCamel}.* を削除できませんでした（${err.message}）`);
  }
  return failures;
}
