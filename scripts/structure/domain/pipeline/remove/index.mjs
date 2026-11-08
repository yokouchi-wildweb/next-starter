// pnpm generate domain -- --delete の本体（対話は cli/delete.mjs）: 削除対象の解決 → ディレクトリの削除 → レジストリの掃除。DB のテーブルは消さない

import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toKebabCase } from "../../../../../src/utils/stringCase.mjs";
import { createDomainContext } from "../../domain/context.mjs";
import { isClosable, overrideRel, ruleContent } from "../../render/featureGate/index.mjs";
import { cleanupRegistries } from "./registries.mjs";
import { findDomainDirs, resolveDeleteTarget, resolveDir } from "./names.mjs";

export { resolveDeleteTarget };
export { codeReferenceStopMessage, codeReferences, deleteStopMessage, inboundReferences } from "./deleteStop.mjs";

/**
 * 管理画面ルート（src/app/admin/(protected)/<domains> か src/app/admin/<domains>）を探し、見つかれば候補名に足す
 * @returns {{ adminDir: string | null, pluralKebab: string }}
 */
export function resolveAdminDir(workspace, target) {
  const { pluralCandidateSet, featureCandidateSet, searchNameSet } = target;
  const adminDir =
    resolveDir(workspace.adminProtectedDir, ...pluralCandidateSet, ...featureCandidateSet) ||
    resolveDir(path.join(workspace.rootDir, "src", "app", "admin"), ...pluralCandidateSet, ...featureCandidateSet);
  let pluralKebab = toKebabCase(target.plural);
  if (adminDir) {
    const adminFolderName = path.basename(adminDir);
    pluralKebab = adminFolderName;
    const adminCamel = toCamelCase(adminFolderName);
    pluralCandidateSet.add(adminCamel);
    pluralCandidateSet.add(adminFolderName);
    searchNameSet.add(adminCamel);
    searchNameSet.add(adminFolderName);
  }
  return { adminDir, pluralKebab };
}

/** src/app 配下で名前が一致する追加ディレクトリ（管理画面ルート本体は除く） */
export function findExtraDirs(workspace, target, adminDir) {
  return findDomainDirs(path.join(workspace.rootDir, "src", "app"), [...target.searchNameSet]).filter((d) => !adminDir || d !== adminDir);
}

/**
 * 閉じられるドメイン(domain.json の closable: true)の門番の規則と上書きの後始末(設定の議会 L1.20 (2)・L1.27)。
 * domain.json も消す削除で一緒に消す物と、消さずに案内する物を返す(domain.json を残す削除 = 作り直す前提では呼び手が使わない)。
 * - 上書き src/config/features/<camel>.config.ts: 消す(持ち主の config.ts が消えるので読まれない。fork の値が入っていても一覧に出してから消す)
 * - 規則 src/featureGate/rules/<camel>.ts: 生成器が今書く中身と同じときだけ消す。手で直してあれば消さずに案内(手で消す)
 * @returns {{ remove: string[], keep: string[] }} どちらも絶対パス(keep = 案内だけ)
 */
export function gateLeftovers(workspace, featureDir) {
  const ctx = createDomainContext(workspace, path.basename(featureDir));
  if (!isClosable(ctx.config)) return { remove: [], keep: [] };
  const remove = [];
  const keep = [];
  const overrideFile = path.join(workspace.rootDir, overrideRel(ctx));
  if (fs.existsSync(overrideFile)) remove.push(overrideFile);
  const ruleFile = path.join(workspace.rootDir, "src", "featureGate", "rules", `${ctx.camel}.ts`);
  if (fs.existsSync(ruleFile)) (fs.readFileSync(ruleFile, "utf8") === ruleContent(ctx) ? remove : keep).push(ruleFile);
  return { remove, keep };
}

/** 削除するパスの一覧（表示用、rootDir からの相対）。gateFiles = 一緒に消す門番の規則・上書き(domain.json も消す削除だけ) */
export function listDeletePaths(workspace, { featureDir, adminDir, extras, gateFiles = [] }) {
  const paths = [];
  if (fs.existsSync(featureDir)) paths.push(path.relative(workspace.rootDir, featureDir));
  if (adminDir && fs.existsSync(adminDir)) paths.push(path.relative(workspace.rootDir, adminDir));
  paths.push(...extras.map((d) => path.relative(workspace.rootDir, d)));
  paths.push(...gateFiles.map((f) => path.relative(workspace.rootDir, f)));
  return paths;
}

/** ディレクトリを消し、レジストリを掃除する。@returns 手で直すレジストリの一覧 */
export function removeDomainFiles(workspace, { target, adminDir, pluralKebab, extras, removeConfig, gateFiles = [] }, io = console) {
  const { featureDir } = target;
  if (adminDir && fs.existsSync(adminDir)) fs.rmSync(adminDir, { recursive: true, force: true });

  if (fs.existsSync(featureDir)) {
    if (removeConfig) {
      fs.rmSync(featureDir, { recursive: true, force: true });
    } else {
      for (const entry of fs.readdirSync(featureDir)) {
        if (entry !== "domain.json") {
          fs.rmSync(path.join(featureDir, entry), { recursive: true, force: true });
        }
      }
    }
  }
  for (const dir of extras) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // 閉じられるドメインの規則・上書き(domain.json も消す削除だけ。呼び手が gateLeftovers の remove を渡す)
  if (removeConfig) for (const file of gateFiles) fs.rmSync(file, { force: true });
  return cleanupRegistries(workspace, io);
}
