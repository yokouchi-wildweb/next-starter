// dc:delete の本体（対話は cli/delete.mjs）: 削除対象の解決 → ディレクトリの削除 → レジストリの掃除。DB のテーブルは消さない

import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toKebabCase } from "../../../../src/utils/stringCase.mjs";
import { cleanupRegistries } from "./registries.mjs";
import { findDomainDirs, resolveDeleteTarget, resolveDir } from "./names.mjs";

export { resolveDeleteTarget };
export { deleteStopMessage } from "./pairStop.mjs";

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
  return cleanupRegistries(workspace, { ...target, pluralKebab }, io);
}
