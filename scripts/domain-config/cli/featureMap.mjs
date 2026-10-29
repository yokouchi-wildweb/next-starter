// pnpm dc:feature-map: ドメインの一覧（src/features/feature-map.txt）を書き出す / --check で照らす（中身は domain/featureMap.mjs）

import { FEATURE_MAP_FILE, buildFeatureMap, featureMapDiff } from "../domain/featureMap.mjs";
import { refreshFeatureMap } from "../pipeline/generate.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {{ check?: boolean }} [options] check = 書かずに照らす（ずれていれば例外 = 終了コード 1）
 */
export function runFeatureMap(workspace, { check = false } = {}) {
  if (!check) {
    if (!refreshFeatureMap(workspace)) console.log(`✓ ${FEATURE_MAP_FILE} は変更なし`);
    return;
  }
  const diff = featureMapDiff(buildFeatureMap(workspace.featureListing()), workspace.readFeatureMap());
  if (diff.length > 0) {
    throw new Error([`✗ ${FEATURE_MAP_FILE} が今のフォルダ・generate とずれています（pnpm dc:feature-map で作り直してコミット）:`, ...diff.map((line) => `  ${line}`)].join("\n"));
  }
  console.log(`✓ ${FEATURE_MAP_FILE} OK`);
}
