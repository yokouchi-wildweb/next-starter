// pnpm generate domain -- --delete の本体（対話は cli/delete.mjs）: 削除対象の解決 → ディレクトリの削除 → レジストリの掃除。DB のテーブルは消さない

import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toKebabCase } from "../../../../../src/utils/stringCase.mjs";
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

/** 規則ファイルの domains: [...] の文字列リテラル(字面。生成器 scripts/structure/extensions/derive/featureTables.mjs の readDomains と同じ読み方の最小形) */
function readRuleDomains(text) {
  const match = /(?:^|[{,\s])domains\s*:\s*\[([\s\S]*?)\]/.exec(text);
  if (!match) return [];
  return match[1].split(",").map((part) => /^\s*["']([^"']+)["']\s*$/.exec(part)?.[1]).filter(Boolean);
}

/**
 * このドメインのフォルダを domains に持つ門番の規則(src/featureGate/rules/<名前>.ts、字面で読む)。削除の前に止める材料(D26: ひな形の後始末はなくした)
 * @returns {string[]} 規則のファイル(rootDir からの相対)
 */
export function gateRuleHolders(workspace, featureDir) {
  const folder = path.relative(path.join(workspace.rootDir, "src", "features"), featureDir).split(path.sep).join("/");
  const dir = path.join(workspace.rootDir, "src", "featureGate", "rules");
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const file = fs.statSync(path.join(dir, name)).isDirectory() ? path.join(dir, name, "index.ts") : path.join(dir, name);
    if (!/\.tsx?$/.test(file) || !fs.existsSync(file)) continue;
    if (readRuleDomains(fs.readFileSync(file, "utf8")).includes(folder)) files.push(path.relative(workspace.rootDir, file));
  }
  return files;
}

/** 門番の規則がこのドメインを持てば止める文(無ければ null) */
export function gateRuleStopMessage(workspace, featureDir) {
  const holders = gateRuleHolders(workspace, featureDir);
  if (holders.length === 0) return null;
  const folder = path.relative(path.join(workspace.rootDir, "src", "features"), featureDir).split(path.sep).join("/");
  return [
    `門番の規則がこのドメイン(${folder})を domains に持つので削除を止めました(何も消していません):`,
    ...holders.map((file) => ` - ${file}`),
    "規則の domains から外す(規則ごと要らなければ規則のファイルを消す)→ pnpm generate extensions → もう一度削除",
  ].join("\n");
}

/** 削除するパスの一覧（表示用、rootDir からの相対） */
export function listDeletePaths(workspace, { featureDir, adminDir, extras }) {
  const paths = [];
  if (fs.existsSync(featureDir)) paths.push(path.relative(workspace.rootDir, featureDir));
  if (adminDir && fs.existsSync(adminDir)) paths.push(path.relative(workspace.rootDir, adminDir));
  paths.push(...extras.map((d) => path.relative(workspace.rootDir, d)));
  return paths;
}

/** ディレクトリを消し、レジストリを掃除する。@returns 手で直すレジストリの一覧 */
export function removeDomainFiles(workspace, { target, adminDir, pluralKebab, extras, removeConfig }, io = console) {
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
  return cleanupRegistries(workspace, io);
}
