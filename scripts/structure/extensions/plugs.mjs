// scripts/structure/extensions/plugs.mjs
// plugs の点(宣言に plugs: true)の項目を集める: 項目は差す側の自分のフォルダ <ドメイン>/plugs/<点の名前>/<名前>.ts(x)(lib は <lib>/plugs/…、D38・D40)。
// 差す側 = 地区の地図の domains と lib の地区(src/lib/districtMap の見つけ方)。項目に domain(lib の項目は null)と requires(ドメインの domainEntry の requires)を付け、
// 使う時に門番の gate.plugs が閉じたドメインの項目を外す(D26)。上限 max・順位 order もここで効かせる。書式: ./README.md

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PLUGS_DIR_NAME, isPlugsPoint } from "../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";

/** 項目の順位(order "declared"): export const order = <数のリテラル> */
const ORDER_EXPORT = /^export\s+const\s+order\s*(?::\s*number\s*)?=\s*(-?\d+(?:\.\d+)?)\s*;?\s*$/m;
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * plugs の点の項目を集める
 * @param {string} repoRoot
 * @param {{ owner: string, name: string, declaredIn: string, spec: Record<string, unknown> }[]} points 全拡張点(plugs の点だけを見る)
 * @param {(repoRoot: string, owner: string, dir: string, points: object[], otherDirs: Set<string>) => { items: Map<string, object[]>, problems: string[] }} discoverDir 受け口のフォルダの走査(項目の名前・export・旧い印の検査を共有)
 * @returns {{ itemsByPoint: Map<object, object[]>, problems: string[] }}
 */
export function discoverPlugs(repoRoot, points, discoverDir) {
  const plugsPoints = points.filter((p) => isPlugsPoint(p.spec));
  const itemsByPoint = new Map(plugsPoints.map((p) => [p, []]));
  const problems = [];
  // 点の名前はリポ全体で一意(plugs/<点の名前>/ で差す先を決めるので、D40)
  const byPointName = new Map();
  for (const p of plugsPoints) {
    const other = byPointName.get(p.name);
    if (other) problems.push(`${p.declaredIn}: plugs の点 ${p.name} は ${other.declaredIn} にもある(plugs の点の名前はリポ全体で一意)`);
    else byPointName.set(p.name, p);
  }
  const districts = readDistrictMapAt(repoRoot).districts.filter((d) => d.kind === "domains" || d.kind === "lib");
  for (const d of districts) {
    const plugsDir = join(repoRoot, d.dir, PLUGS_DIR_NAME);
    if (!existsSync(plugsDir)) continue;
    for (const entry of readdirSync(plugsDir, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name))) {
      const label = `${d.dir}/${PLUGS_DIR_NAME}/${entry.name}`;
      const point = byPointName.get(entry.name);
      if (!entry.isDirectory()) {
        problems.push(`${label}: plugs の直下は点の名前のフォルダだけ(項目は ${d.dir}/${PLUGS_DIR_NAME}/<点の名前>/<名前>.ts(x))`);
        continue;
      }
      if (!point) {
        problems.push(`${label}: plugs の点 ${entry.name} が無い(差す先の点の名前。宣言は持ち主の extensionPoints.ts の { change: "add", plugs: true, … })`);
        continue;
      }
      const found = discoverDir(repoRoot, d.dir, `${PLUGS_DIR_NAME}/${entry.name}`, [point], new Set());
      problems.push(...found.problems);
      const domain = d.kind === "domains" ? d.name : null;
      const requires = d.kind === "domains" ? [...(d.requires ?? [])].sort(byName) : [];
      for (const item of found.items.get(point.name) ?? []) itemsByPoint.get(point).push({ ...item, source: d.name, plug: { domain, requires } });
    }
  }
  for (const point of plugsPoints) {
    const items = itemsByPoint.get(point);
    const { spec } = point;
    // 順位: file = <差す側>/<名前> の順、declared = 項目の export const order → <差す側>/<名前>
    const orderOf = new Map();
    if (spec.order === "declared") {
      for (const item of items) {
        const match = ORDER_EXPORT.exec(item.text);
        if (match) orderOf.set(item, Number(match[1]));
        else problems.push(`${item.path}: export const order = <数> が無い(点 ${point.name} は順位を項目が宣言する order "declared")`);
      }
    }
    items.sort((a, b) => (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0) || byName(`${a.source}/${a.name}`, `${b.source}/${b.name}`));
    // 上限(空なら点の持ち主の既定で動く、D53)
    if (typeof spec.max === "number" && items.length > spec.max) {
      problems.push(`${point.declaredIn}: 点 ${point.name} の項目は ${spec.max} 個まで(今 ${items.length} 個: ${items.map((i) => i.path).join("・")})`);
    }
    // 鍵の全体の一意(D41 (2)): 字面で読める鍵だけ。ぶつかった項目を両方出す
    if (typeof spec.key === "string") {
      const keyPattern = new RegExp(`\\b${spec.key}:\\s*["']([^"']+)["']`);
      const seen = new Map();
      for (const item of items) {
        const key = keyPattern.exec(item.text)?.[1];
        if (key === undefined) continue;
        if (seen.has(key)) problems.push(`${item.path}: 点 ${point.name} の ${spec.key} "${key}" は ${seen.get(key)} とぶつかる(鍵は全体で一意)`);
        else seen.set(key, item.path);
      }
    }
  }
  return { itemsByPoint, problems };
}
