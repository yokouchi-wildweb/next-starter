// scripts/structure/extensions/plugs.mjs
// plugs の点(宣言に plugs: true)の項目を集める: 項目は差す側の自分のフォルダ <ドメイン>/plugs/<点の名前>/<名前>.ts(x)(lib は <lib>/plugs/…、D38・D40)。
// 差す側 = 地区の地図の domains と lib の地区(src/lib/districtMap の見つけ方)。項目に domain(lib の項目は null)と requires(ドメインの登録の entity.json の requires)を付け、
// 使う時に門番の gate.plugs が閉じたドメインの項目を外す(D26)。上限 max・順位 order もここで効かせる。書式: ./README.md

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PLUGS_DIR_NAME, PLUGS_REGISTRY_FOLDERS, isPlugsPoint } from "../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";

/** 項目の順位(order "declared"): export const order = <数のリテラル> */
const ORDER_EXPORT = /^export\s+const\s+order\s*(?::\s*number\s*)?=\s*(-?\d+(?:\.\d+)?)\s*;?\s*$/m;
/** 項目の段(stages の点、注文 31): export const stage = "<名前>"(字面) */
const STAGE_EXPORT = /^export\s+const\s+stage\s*=\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*(?:as\s+const\s*)?;?\s*$/m;
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
  const seenNames = new Map();
  for (const p of plugsPoints) {
    const other = seenNames.get(p.name);
    if (other) problems.push(`${p.declaredIn}: plugs の点 ${p.name} は ${other.declaredIn} にもある(plugs の点の名前はリポ全体で一意)`);
    else if (PLUGS_REGISTRY_FOLDERS.includes(p.name)) problems.push(`${p.declaredIn}: plugs の点の名前 ${p.name} は登録表の項目のフォルダ(plugs/${p.name}/、pnpm generate registry が集める)と同じ。別の名前にする`);
    else seenNames.set(p.name, p);
  }
  // フォルダ plugs/<点>/ → そのフォルダを読む点(主の点と、itemsOf でその項目のフォルダの別のファイルを読む点。注文 25)
  const byPointName = new Map();
  for (const p of plugsPoints.filter((point) => point.spec.itemsOf === undefined && seenNames.get(point.name) === point)) byPointName.set(p.name, [p]);
  for (const p of plugsPoints.filter((point) => typeof point.spec.itemsOf === "string")) {
    const group = byPointName.get(p.spec.itemsOf);
    if (group && group[0].owner === p.owner) group.push(p);
    else problems.push(`${p.declaredIn}: ${p.name} の itemsOf ${p.spec.itemsOf} が同じ宣言の plugs の点に無い`);
  }
  const districts = readDistrictMapAt(repoRoot).districts.filter((d) => d.kind === "domains" || d.kind === "lib");
  for (const d of districts) {
    const plugsDir = join(repoRoot, d.dir, PLUGS_DIR_NAME);
    if (!existsSync(plugsDir)) continue;
    for (const entry of readdirSync(plugsDir, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name))) {
      const label = `${d.dir}/${PLUGS_DIR_NAME}/${entry.name}`;
      const group = byPointName.get(entry.name);
      // 登録表の項目のフォルダ(messages・recordTargets、D42)は増設点ではない: 集めるのは pnpm generate registry
      if (entry.isDirectory() && d.kind === "domains" && PLUGS_REGISTRY_FOLDERS.includes(entry.name)) continue;
      if (!entry.isDirectory()) {
        problems.push(`${label}: plugs の直下は点の名前のフォルダだけ(項目は ${d.dir}/${PLUGS_DIR_NAME}/<点の名前>/<名前>.ts(x))`);
        continue;
      }
      if (!group) {
        problems.push(`${label}: plugs の点 ${entry.name} が無い(差す先の点の名前。宣言は持ち主の extensionPoints.ts の { change: "add", plugs: true, … })`);
        continue;
      }
      const found = discoverDir(repoRoot, d.dir, `${PLUGS_DIR_NAME}/${entry.name}`, group, new Set());
      problems.push(...found.problems);
      const domain = d.kind === "domains" ? d.name : null;
      const requires = d.kind === "domains" ? [...(d.requires ?? [])].sort(byName) : [];
      // 常設のドメインか(lib の項目は閉じないので常設と同じに扱う)。ちょうど 1 つの点を埋められるのは常設だけ(D53)
      const standing = d.kind === "lib" || d.alwaysOpen === true;
      for (const point of group) for (const item of found.items.get(point.name) ?? []) itemsByPoint.get(point).push({ ...item, source: d.name, standing, plug: { domain, requires } });
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
    // 段: stages の並び → <差す側>/<名前>。知らない段・骨組みだけの段は止める(D30)
    if (Array.isArray(spec.stages)) {
      const skeleton = Array.isArray(spec.skeletonStages) ? spec.skeletonStages : [];
      for (const item of items) {
        const stage = STAGE_EXPORT.exec(item.text)?.[1];
        if (stage === undefined) problems.push(`${item.path}: export const stage = "<段>" が無い(点 ${point.name} の段: ${spec.stages.filter((s) => !skeleton.includes(s)).join(" | ")})`);
        else if (!spec.stages.includes(stage)) problems.push(`${item.path}: 段 ${stage} は点 ${point.name} に無い(段: ${spec.stages.filter((s) => !skeleton.includes(s)).join(" | ")})`);
        else if (skeleton.includes(stage)) problems.push(`${item.path}: 段 ${stage} は点の持ち主の骨組みだけが使う(項目の段: ${spec.stages.filter((s) => !skeleton.includes(s)).join(" | ")})`);
        else {
          item.stage = stage;
          orderOf.set(item, spec.stages.indexOf(stage));
        }
      }
    }
    items.sort((a, b) => (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0) || byName(`${a.source}/${a.name}`, `${b.source}/${b.name}`));
    // ちょうど 1 つ(required、D53): 空は止める(既定を差す常設のドメインの項目が要る)
    if (spec.required === true && items.length === 0) {
      problems.push(`${point.declaredIn}: 点 ${point.name} は項目がちょうど 1 つ要る(required。今 0 個: 差す側の <ドメイン>/plugs/${point.name}/<名前>.ts)`);
    }
    // ちょうど 1 つの点を埋めるのは常設のドメインか lib だけ(閉じられるドメインが埋めると閉じた時に点が空になる、D53)
    if (spec.required === true) {
      for (const item of items.filter((i) => !i.standing)) {
        problems.push(`${item.path}: 点 ${point.name} はちょうど 1 つ要る点(required)。埋められるのは常設のドメイン(extensionPoints.ts の export const alwaysOpen = true)か lib だけ(${item.source} は機能の規則に載り閉じうる、D53)`);
      }
    }
    // 上限(空なら点の持ち主の既定で動く、D53)
    if (typeof spec.max === "number" && items.length > spec.max) {
      problems.push(`${point.declaredIn}: 点 ${point.name} の項目は ${spec.max} 個まで(今 ${items.length} 個: ${items.map((i) => i.path).join("・")})`);
    }
    // shape "object" の名前(鍵になる項目の名前)は差す側をまたいで一意(注文 25)
    if (spec.shape === "object") {
      const seenName = new Map();
      for (const item of items) {
        if (seenName.has(item.name)) problems.push(`${item.path}: 点 ${point.name} の項目の名前 ${item.name} は ${seenName.get(item.name)} とぶつかる(名前が鍵なので全体で一意)`);
        else seenName.set(item.name, item.path);
      }
    }
    // 鍵の全体の一意(D41 (2)): 字面で読める鍵だけ。ぶつかった項目を両方出す
    if (typeof spec.key === "string") {
      const keyPattern = new RegExp(`\\b${spec.key}:\\s*["']([^"']+)["']`);
      const seen = new Map();
      for (const item of items) {
        const key = keyPattern.exec(item.text)?.[1];
        if (key === undefined) {
          if (spec.keyPrefix === "district") problems.push(`${item.path}: 点 ${point.name} の ${spec.key} を字面("<地区>.<名前>")で書く(先頭が差した地区かを生成が確かめる)`);
          continue;
        }
        // keyPrefix "district": 鍵の先頭は項目を置いた地区の名前(<地区>.<名前>、D23)
        if (spec.keyPrefix === "district" && !key.startsWith(`${item.source}.`)) {
          problems.push(`${item.path}: 点 ${point.name} の ${spec.key} "${key}" の先頭は項目を置いた地区 ${item.source} にする("${item.source}.<名前>")`);
        }
        if (seen.has(key)) problems.push(`${item.path}: 点 ${point.name} の ${spec.key} "${key}" は ${seen.get(key)} とぶつかる(鍵は全体で一意)`);
        else seen.set(key, item.path);
      }
    }
  }
  return { itemsByPoint, problems };
}
