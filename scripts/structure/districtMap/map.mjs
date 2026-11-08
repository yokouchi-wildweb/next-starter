// scripts/structure/districtMap/map.mjs
// 地区の地図の集約ファイル src/registry/district-map.jsonl を作る・照らす(生成器と検査器の共通の部品)。
// 読み手は src/lib/districtMap(道具・lint・生成は毎回それを呼ぶ。この jsonl は人・agent・/ship と /flux の差分用で、他の生成の入力にしない、目録 D12)。

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DISTRICT_MAP_FILE, toJsonl } from "../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * 地図を読んで jsonl の本文にする
 * @param {string} root
 * @returns {{ text: string | null, problems: string[], count: number }} 問題があれば text = null(書かない)
 */
export function buildDistrictMap(root = repoRoot) {
  const { districts, problems } = readDistrictMapAt(root);
  return { text: problems.length > 0 ? null : toJsonl(districts), problems, count: districts.length };
}

/** 生成: 書いたら 0、問題があれば書かずに 1 */
export function generateDistrictMap(root = repoRoot) {
  const built = buildDistrictMap(root);
  if (built.text === null) return { ok: false, lines: ["地区の地図を作れない(書かなかった):", ...built.problems.map((p) => `  - ${p}`)] };
  writeFileSync(join(root, DISTRICT_MAP_FILE), built.text);
  return { ok: true, lines: [`${DISTRICT_MAP_FILE}: ${built.count} 地区`] };
}

/** 検査: 今の木から作った物と jsonl が同じなら ok */
export function checkDistrictMap(root = repoRoot) {
  const built = buildDistrictMap(root);
  if (built.text === null) return { ok: false, lines: ["地区の地図に問題がある:", ...built.problems.map((p) => `  - ${p}`)] };
  const path = join(root, DISTRICT_MAP_FILE);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === built.text) return { ok: true, lines: [`${DISTRICT_MAP_FILE}: 今の木と一致(${built.count} 地区)`] };
  const what = current === null ? "が無い" : "が今の木と違う(古いか手で直した)";
  return { ok: false, lines: [`${DISTRICT_MAP_FILE} ${what}。pnpm generate districtMap で作り直す(手で直さない)`] };
}
