// scripts/structure/config-overrides/pairing.mjs
// 上書きと持ち主の 1 対 1 の検査(設定 D19・D38・D75)。地区の地図(src/lib/districtMap)の利用者。
// 見る所は src/config の地区の 4 つの種類のフォルダ(lib・features・layout・proxies)と基盤の上書きのフォルダ(featureGate、設定 D91)だけ。
// 古い app/・ui/ と直下のファイルは見ない(移行中)。
//
// 落とす物:
//   余り   = 持ち主の地区が無い上書き / 持ち主の config.ts(ui は config.ui.ts)が無い上書き / フォルダの中の置けない名前・サブフォルダ
//   欠落   = config.ts があるのに上書きが無い(features・frame・proxies。lib は package.json を宣言した lib なら pnpm check lib-package の持ち分なので数えない)
//          = config.ui.ts があるのに <名前>.ui.config.ts が無い(全種類)
// 欠落の上書きは import していれば tsc も落とすが、import していなくても揃えるのが上流の約束(D9: 持ち主ごとに上書きを一通り置く)。

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { BASE_OVERRIDE_FOLDERS, DISTRICT_KINDS, OVERRIDE_FOLDERS, OVERRIDE_ROOT } from "../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { hasLibPackage } from "../../../src/lib/libPackage/index.mjs";

/** 種類のフォルダに置ける物(上書き・描画用の上書き・README) */
const OVERRIDE_FILE = /^[^.]+\.config\.ts$/;
const UI_OVERRIDE_FILE = /^[^.]+\.ui\.config\.ts$/;
const ALLOWED_OTHER = new Set(["README.md"]);

const KIND_LABEL = { features: "ドメイン", lib: "lib", frame: "枠", proxies: "proxies" };

/** 種類のフォルダの直下の { name, isDir }(無ければ []) */
function listFolder(root, rel) {
  const abs = join(root, rel);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** 持ち主が見つからない上書きの直し方(種類ごと) */
function ownerHint(kind, name) {
  if (kind === "frame") return `枠の _layout/config.ts に frame: "${name}" の宣言が無い。枠の名前を確かめるか、要らない上書きなら消す(設定 D75)`;
  if (kind === "proxies") return `proxies の上書きは proxies.config.ts(と proxies.ui.config.ts)だけ(設定 D36)`;
  return `${KIND_LABEL[kind]} ${name} が無い(消された・改名された・打ち間違い)。持ち主の名前に合わせるか、要らない上書きなら消す`;
}

/**
 * 上書きと持ち主の対を照らす
 * @param {string} root リポジトリの根
 * @returns {{ ok: boolean, problems: string[], pairs: number, mapProblems: string[] }}
 *   pairs = 揃った対の数(値・ui を別に数える)。mapProblems があれば地図が読めないので照らさない
 */
export function checkOverridePairs(root) {
  const { districts, problems: mapProblems } = readDistrictMapAt(root);
  if (mapProblems.length > 0) return { ok: false, problems: [], pairs: 0, mapProblems };

  const problems = [];
  let pairs = 0;
  /** 上書きのパス → { 地区, ui か } */
  const slots = new Map();
  for (const d of districts) {
    slots.set(d.override.path, { d, ui: false });
    slots.set(d.uiOverride.path, { d, ui: true });
  }

  // 余り: 種類のフォルダの中を 1 つずつ持ち主に当てる
  for (const kind of DISTRICT_KINDS) {
    const folder = `${OVERRIDE_ROOT}/${OVERRIDE_FOLDERS[kind]}`;
    for (const entry of listFolder(root, folder)) {
      const path = `${folder}/${entry.name}`;
      if (entry.isDir) {
        problems.push(`${path}/: 種類のフォルダの中は平ら(サブフォルダを置かない、設定 D11)。上書きは ${folder}/<名前>.config.ts`);
        continue;
      }
      if (ALLOWED_OTHER.has(entry.name)) continue;
      const ui = UI_OVERRIDE_FILE.test(entry.name);
      if (!ui && !OVERRIDE_FILE.test(entry.name)) {
        problems.push(`${path}: 置けない名前。上書きは <名前>.config.ts、描画専用は <名前>.ui.config.ts(設定 D19・D38)`);
        continue;
      }
      const slot = slots.get(path);
      const name = entry.name.replace(ui ? /\.ui\.config\.ts$/ : /\.config\.ts$/, "");
      if (!slot || slot.d.kind !== kind) {
        problems.push(`${path}: 持ち主の無い上書き(余り、読まれず黙って効かない)。${ownerHint(kind, name)}(設定 D19)`);
        continue;
      }
      const owner = ui ? slot.d.uiConfig : slot.d.config;
      if (!owner.exists) {
        problems.push(
          `${path}: 持ち主 ${slot.d.dir} に ${owner.path.split("/").pop()} が無い上書き(余り)。${ui ? "描画専用の上書きは持ち主が描画用の config を持つときだけ置く(設定 D38)" : "持ち主の config.ts と同じ commit で作る"}(設定 D19)`,
        );
      }
    }
  }

  // 基盤の上書き(設定 D91): 持ち主は固定のフォルダ。名前は中身の名前で、どれを置くかは持ち主の物なので欠落は数えない
  for (const [base, ownerDir] of Object.entries(BASE_OVERRIDE_FOLDERS)) {
    const folder = `${OVERRIDE_ROOT}/${base}`;
    const ownerExists = existsSync(join(root, ownerDir)) && statSync(join(root, ownerDir)).isDirectory();
    for (const entry of listFolder(root, folder)) {
      const path = `${folder}/${entry.name}`;
      if (entry.isDir) {
        problems.push(`${path}/: 基盤の上書きのフォルダの中は平ら(サブフォルダを置かない、設定 D91)。上書きは ${folder}/<中身の名前>.config.ts`);
        continue;
      }
      if (ALLOWED_OTHER.has(entry.name)) continue;
      if (!OVERRIDE_FILE.test(entry.name)) {
        problems.push(`${path}: 置けない名前。基盤の上書きは <中身の名前>.config.ts(設定 D91)`);
        continue;
      }
      if (!ownerExists) {
        problems.push(`${path}: 持ち主 ${ownerDir} が無い上書き(余り、読まれず黙って効かない)。要らない上書きなら消す(設定 D91)`);
        continue;
      }
      pairs += 1;
    }
  }

  // 欠落: 持ち主の config があるのに上書きが無い
  for (const d of districts) {
    if (d.config.exists) {
      if (d.override.exists) pairs += 1;
      else if (!(d.kind === "lib" && hasLibPackage(root, d.name))) {
        problems.push(`${d.config.path}: 上書き ${d.override.path} が無い(欠落)。上流は空の上書き(export default {} satisfies <型>)を同じ commit で置く(設定 D9・D19)`);
      }
    }
    if (d.uiConfig.exists) {
      if (d.uiOverride.exists) pairs += 1;
      else problems.push(`${d.uiConfig.path}: 描画専用の上書き ${d.uiOverride.path} が無い(欠落)。空の上書きを同じ commit で置く(設定 D19・D38)`);
    }
  }

  return { ok: problems.length === 0, problems, pairs, mapProblems };
}

/** 門の出力の行 */
export function reportLines(result) {
  if (result.mapProblems.length > 0) return ["地区の地図に問題があるので上書きを照らせない(pnpm check district-map):", ...result.mapProblems.map((p) => `  - ${p}`)];
  if (result.ok) return [`config-overrides: 上書きと持ち主の対 ${result.pairs} 組、余り 0・欠落 0`];
  return [`config-overrides: 上書きと持ち主が揃っていない(${result.problems.length} 件):`, ...result.problems.map((p) => `  - ${p}`)];
}
