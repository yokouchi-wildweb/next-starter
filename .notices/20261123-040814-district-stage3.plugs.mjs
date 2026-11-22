#!/usr/bin/env node
// .notices/20261123-040814-district-stage3.plugs.mjs
// ドメインの増設点の項目を plugs へ移す(地区の議会 段 3、D38・D40・D42)。上流(Tier1)も fork も同じ道具で、リポのルートで走らせる。
// (区切り district-stage3 の notice 20261123-040814-district-stage3 の道具)
// 使い方: node .notices/20261123-040814-district-stage3.plugs.mjs [--apply] [--json] [--owner <項目のパス>=<ドメイン か lib のフォルダ> …] [--only <持ち主のフォルダ>,…]
//   --only: その持ち主の点だけ(上流は 3 つの注文に分けて当てた。adminBulkActions はどれかの持ち主か core/admin を挙げれば全部の持ち主を一度に)
//   既定は dry-run(点の書き換えと項目の行き先の表を出すだけ、何も書かない)。--apply で書く。2 回目は何もしない(plugs の点は触らない)
//
// 対象: ドメイン(src/domains の下)が宣言した受け口のフォルダの増設点(dir か files を持つ、plugs でない点)。枠・門番・proxies の点は段 3 の別の札
// 点の書き換え(--apply):
// - 名前: 持ち主の名前で始める(注文 24 Q1 = a、D40: plugs/<点>/ のフォルダ名は全体で一意)。既に <持ち主>… で始まる名前はそのまま、
//   ほかは <持ち主><点の名前の先頭を大文字>(例 user の cleanupHandlers → userCleanupHandlers、setting の fields → settingFields)
// - adminBulkActions は 1 点(注文 24 Q2 = a): 持ち主は src/domains/core/admin、名前はそのまま。各ドメインの宣言の adminBulkActions は消し、
//   項目 <ドメイン>/plugs/adminBulkActions/<名前>.tsx はそのドメインの一覧に効く(行き先はいつも今の持ち主 = 一覧のドメイン)
// - 宣言: dir: "<フォルダ>" を plugs: true に、点の鍵を新しい名前に(ほかの欄はそのまま。plugs の生成器が受けない欄は表の features に出す)
// - 1 つのフォルダを読む点が複数(連絡のレイアウト: layouts・layoutEmails・layoutInApps、files の点)は、主の点(フォルダと同じ名前の点、
//   無ければ overrideOf の点、無ければ最初)の項目のフォルダを 1 回だけ動かし、ほかの点は itemsOf: "<主の点の新しい名前>" で同じフォルダを読む(注文 25 Q1)
// - 動かしたフォルダの中にある差替点の既定(<名前>.default.tsx)は、宣言の default と type.from のパスを新しい置き場に書き換える
// 項目の行き先(D38: 業務の項目 = その概念のドメイン、業務でない項目 = 差す側の lib):
//   1. 名前: 項目の名前がドメインの名前か、ドメインの名前(か複数形 +s)の後に大文字が続く(walletAdjusted → wallet、coupons → coupon)。一番長い名前
//   2. 名前が無ければ持ち主のまま。項目が読むドメイン(@/domains/[core/]<d>/…、持ち主は除く)は行き先にしない: 読む相手は requires(D38)。
//      表に reads として出すだけ(人が --owner で動かせる。注文 24 で import の 1 つを行き先にすると email の配送路 → user・利用者の群れの条件 → user
//      のように概念でない先へ動いたので外した)
//   決めない物: --owner の行き先が無いドメイン・lib / fork で行き先が上流の場所 → 候補つきで止める
//   fork: 行き先は fork 自身のドメインか lib だけ(上流のコアドメイン src/domains/core/ と src/lib の中には足さない、D38)。上流の場所になる物は止める
// 一緒に動く物: 項目の隣の <名前>.override.ts・<名前>.test.ts(x)。それ以外(受け口の README・複数の項目のテスト)は表の leftovers に出す(26 で片付ける)
// 動かしたファイルの相対の import は元の場所から解いて書き直す(src の下は @/、フォルダの項目の中はそのまま。注文 27)
// 書かない物: 生成一覧(pnpm generate extensions・registry が作り直す)・読み手のコード(門番の gate.plugs を掛けるのは 26)
// 登録表の項目のフォルダ(注文 29、D42): ドメインの messages/ と recordTargets/ をフォルダごと <ドメイン>/plugs/messages|recordTargets/ へ
//   (中の .override・テストも一緒、相対の import は書き直す。連絡の鍵 <ドメイン>.<名前> は変わらない)。行き先のフォルダが既にあれば
//   (fork が上流のドメインの messages/ に置いた上書き = 取り込みで上流のフォルダは先に動いている)中身を 1 つずつ合わせ、同じ名前があれば止める。--only はそのドメインのフォルダだけ
//
// fork の手順: 上流の段 3 の区間を取り込む → dry-run → 止めた物を --owner で決める → --apply → pnpm generate extensions・district-map

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { isListPoint, isPlugsPoint, PLUGS_DIR_NAME, PLUGS_REGISTRY_FOLDERS } from "../src/lib/districtMap/index.mjs";
import { collectPoints, readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { readForkIdentity } from "../src/lib/forkOwnership/node.mjs";

/** adminBulkActions の 1 点(注文 24 Q2)の持ち主 */
export const ADMIN_BULK_OWNER = "src/domains/core/admin";
export const ADMIN_BULK_POINT = "adminBulkActions";
/** plugs の生成器がまだ受けない欄(注文 25 で全部受けた。新しく足した欄が受けられない時だけここに書く) */
export const PLUGS_MISSING_FEATURES = [];
/** 走査する登録表の項目のフォルダ(D42: plugs の下へ。点と持ち主は 26 で決める) */
export const REGISTRY_FOLDERS = PLUGS_REGISTRY_FOLDERS;

const ITEM_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const SOURCE = /\.(tsx?|mts|mjs)$/;
const SKIPPED = /\.(test|spec|d)\.[cm]?tsx?$/;
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ownerName = (owner) => owner.slice(owner.lastIndexOf("/") + 1);

/**
 * 点の新しい名前(注文 24 Q1): 持ち主の名前で始める。adminBulkActions はそのまま
 * @param {string} owner
 * @param {string} name
 */
export function plugsNameOf(owner, name) {
  if (name === ADMIN_BULK_POINT) return name;
  const prefix = ownerName(owner);
  if (name === prefix || (name.startsWith(prefix) && /[A-Z]/.test(name.charAt(prefix.length)))) return name;
  return `${prefix}${cap(name)}`;
}

/**
 * 項目の名前が指すドメイン(一番長い名前。名前そのもの・名前の後に大文字・複数形 +s / y → ies の後に大文字か終わり)
 * @param {string} item
 * @param {string[]} domains
 */
export function domainByName(item, domains) {
  const hits = domains.filter((d) => {
    for (const stem of [d, `${d}s`, ...(d.endsWith("y") ? [`${d.slice(0, -1)}ies`] : [])]) {
      if (item === stem) return true;
      if (item.startsWith(stem) && /[A-Z]/.test(item.charAt(stem.length))) return true;
    }
    return false;
  });
  return hits.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * ソースが読むドメイン(@/domains/<d>/… と @/domains/core/<d>/…。動的 import も)
 * @param {string} text
 */
export function domainsImported(text) {
  const out = new Set();
  for (const m of text.matchAll(/["']@\/domains\/(?:core\/)?([A-Za-z][A-Za-z0-9]*)(?:\/|["'])/g)) out.add(m[1]);
  return out;
}

/**
 * 行き先を決める
 * @param {{ owner: string, item: string, texts: string[], domains: string[] }} input owner = 持ち主のドメインの名前
 * @returns {{ to: string, rule: "owner" | "name", reads: string[] }} reads = 読むドメイン(行き先にしない。requires の候補、D38)
 */
export function destinationOf({ owner, item, texts, domains }) {
  const named = domainByName(item, domains);
  const imported = new Set();
  for (const text of texts) for (const d of domainsImported(text)) if (d !== owner && domains.includes(d)) imported.add(d);
  const reads = [...imported].sort(byName);
  if (named && named !== owner) return { to: named, rule: "name", reads };
  return { to: owner, rule: "owner", reads };
}

/** フォルダの中のソースを全部読む */
function textsUnder(abs) {
  if (!statSync(abs).isDirectory()) return [readFileSync(abs, "utf8")];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? textsUnder(join(abs, e.name)) : SOURCE.test(e.name) ? [readFileSync(join(abs, e.name), "utf8")] : []));
}

/**
 * 受け口のフォルダの項目と、一緒に動く物・残る物
 * @param {string} root
 * @param {string} dir 受け口のフォルダ(リポ直下から)
 * @param {{ files?: string[], ignore?: string[] }} shape files = files の点の項目のファイル名(フォルダ形だけ)
 */
export function itemsIn(root, dir, { files = [], ignore = [] } = {}) {
  const abs = join(root, dir);
  /** @type {{ name: string, path: string, folder: boolean, companions: string[] }[]} */
  const items = [];
  const leftovers = [];
  if (!existsSync(abs)) return { items, leftovers };
  const entries = readdirSync(abs, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name));
  const names = new Set();
  for (const e of entries) {
    if (ignore.includes(e.name)) continue;
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      const marker = files.length > 0 ? files.some((f) => existsSync(join(abs, e.name, f))) : ["index.ts", "index.tsx"].some((f) => existsSync(join(abs, e.name, f)));
      if (marker && ITEM_NAME.test(e.name)) {
        items.push({ name: e.name, path, folder: true, companions: [] });
        names.add(e.name);
      } else leftovers.push(path);
      continue;
    }
    const base = e.name.replace(/\.(tsx?)$/, "");
    if (files.length === 0 && /\.tsx?$/.test(e.name) && !SKIPPED.test(e.name) && ITEM_NAME.test(base) && base !== "extensionPoints") {
      items.push({ name: base, path, folder: false, companions: [] });
      names.add(base);
    }
  }
  for (const e of entries) {
    if (ignore.includes(e.name) || e.isDirectory()) continue;
    const path = `${dir}/${e.name}`;
    if (items.some((i) => i.path === path)) continue;
    const stem = /^([A-Za-z][A-Za-z0-9]*)\.(override|test|spec)\.tsx?$/.exec(e.name)?.[1];
    const owner = stem ? items.find((i) => i.name === stem) : undefined;
    if (owner) owner.companions.push(path);
    else leftovers.push(path);
  }
  return { items, leftovers };
}

/** 上流の場所か(fork は足せない: コアドメインと lib、D38) */
const isUpstreamPlace = (dir) => dir.startsWith("src/domains/core/") || dir.startsWith("src/lib/");

/**
 * 計画を立てる(何も書かない)
 * @param {string} root
 * @param {{ owners?: Record<string, string>, only?: string[] | null }} [options] owners = 項目のパス → 行き先のフォルダ(止めた物を人が決める)/ only = この持ち主の点だけ
 */
export function planPlugs(root, { owners = {}, only = null } = {}) {
  const { isTier1 } = readForkIdentity(root);
  const districts = readDistrictMapAt(root).districts;
  const domainDirs = new Map(districts.filter((d) => d.kind === "domains").map((d) => [d.name, d.dir]));
  const domains = [...domainDirs.keys()];
  const { points } = collectPoints(root);
  const candidates = points.filter((p) => p.owner.startsWith("src/domains/") && isListPoint(p.spec) && !isPlugsPoint(p.spec) && (typeof p.spec.dir === "string" || typeof p.spec.files === "string"));
  // --only: 挙げた持ち主の点だけ。adminBulkActions は 1 点にまとめるので、持ち主のどれか(か core/admin)を挙げれば全部
  const bulkOwners = candidates.filter((p) => p.name === ADMIN_BULK_POINT).map((p) => p.owner);
  const withBulk = only !== null && [ADMIN_BULK_OWNER, ...bulkOwners].some((o) => only.includes(o));
  const targets = only === null ? candidates : candidates.filter((p) => (p.name === ADMIN_BULK_POINT ? withBulk : only.includes(p.owner)));
  /** @type {object[]} */
  const conversions = [];
  /** @type {object[]} */
  const moves = [];
  /** @type {object[]} */
  const stops = [];
  /** @type {string[]} */
  const leftovers = [];
  // 同じフォルダを受け口にする点(messaging の layouts の 3 点)は項目のフォルダを 1 回だけ動かす
  const byDir = new Map();
  for (const p of targets) {
    const dir = posix.normalize(posix.join(p.owner, String(p.spec.dir ?? ".")));
    byDir.set(dir, [...(byDir.get(dir) ?? []), p]);
  }
  for (const [dir, group] of [...byDir.entries()].sort(([a], [b]) => byName(a, b))) {
    const owner = group[0].owner;
    const own = ownerName(owner);
    // 主の点: フォルダと同じ名前 → overrideOf を持つ → 最初(ほかの点は itemsOf で同じフォルダを読む)
    const folderName = dir.slice(dir.lastIndexOf("/") + 1);
    const main = group.find((p) => p.name === folderName) ?? group.find((p) => p.spec.overrideOf) ?? group[0];
    for (const p of group) {
      conversions.push({
        declaredIn: p.declaredIn,
        owner,
        from: p.name,
        to: plugsNameOf(owner, p.name),
        dir,
        merged: p.name === ADMIN_BULK_POINT ? ADMIN_BULK_OWNER : null,
        itemsOf: group.length > 1 && p !== main ? plugsNameOf(owner, main.name) : null,
        features: PLUGS_MISSING_FEATURES.filter((k) => p.spec[k] !== undefined),
      });
    }
    const files = group.map((p) => p.spec.files).filter((f) => typeof f === "string").map((f) => f.slice("*/".length));
    const ignore = group.flatMap((p) => (Array.isArray(p.spec.ignore) ? p.spec.ignore : []));
    const found = itemsIn(root, dir, { files, ignore });
    leftovers.push(...found.leftovers);
    const pointName = plugsNameOf(owner, main.name);
    for (const item of found.items) {
      const given = owners[item.path];
      const decided = given
        ? { to: given, rule: "given", reads: [] }
        : main.name === ADMIN_BULK_POINT
          ? { to: own, rule: "list", reads: [] }
          : destinationOf({ owner: own, item: item.name, texts: textsUnder(join(root, item.path)), domains });
      const toDir = given ?? domainDirs.get(decided.to);
      if (!toDir) {
        stops.push({ path: item.path, point: pointName, text: `行き先 ${decided.to} が無い(--owner はリポ直下からのフォルダ: src/domains/[core/]<名前> か src/lib/<名前>)`, candidates: [] });
        continue;
      }
      if (!isTier1 && isUpstreamPlace(toDir)) {
        stops.push({ path: item.path, point: pointName, text: `行き先 ${toDir} は上流の場所(fork の項目は自分のドメインか lib へ、D38)`, candidates: [] });
        continue;
      }
      const base = item.path.slice(dir.length + 1);
      const dest = `${toDir}/${PLUGS_DIR_NAME}/${pointName}`;
      moves.push({ from: item.path, to: `${dest}/${base}`, rule: decided.rule, reads: decided.reads, point: pointName, companions: item.companions.map((c) => ({ from: c, to: `${dest}/${c.slice(dir.length + 1)}` })) });
    }
  }
  // 登録表の項目のフォルダ(messages・recordTargets、D42): フォルダごと <ドメイン>/plugs/<フォルダ>/ へ(注文 29)
  const registry = [];
  for (const [name, dir] of [...domainDirs.entries()].sort(([a], [b]) => byName(a, b))) {
    if (only !== null && !only.includes(dir)) continue;
    for (const folder of REGISTRY_FOLDERS) {
      const from = `${dir}/${folder}`;
      if (!existsSync(join(root, from)) || !statSync(join(root, from)).isDirectory()) continue;
      const to = `${dir}/${PLUGS_DIR_NAME}/${folder}`;
      const merge = existsSync(join(root, to));
      if (merge) {
        const clash = readdirSync(join(root, from)).filter((entry) => existsSync(join(root, to, entry)));
        if (clash.length > 0) {
          stops.push({ path: from, point: folder, text: `行き先 ${to} に同じ名前がある(${clash.join("・")}。どちらかに 1 つにまとめてから動かす)`, candidates: [] });
          continue;
        }
      }
      registry.push({ domain: name, folder, from, to, merge, items: itemsIn(root, from).items.map((item) => item.path) });
    }
  }
  // 動かすフォルダの中の差替点の既定(宣言の default・type.from を新しい置き場へ)
  const replaces = [];
  for (const p of points.filter((point) => typeof point.spec.default === "string")) {
    const move = moves.find((m) => String(p.spec.default).startsWith(`${m.from}/`));
    if (move) replaces.push({ declaredIn: p.declaredIn, point: p.name, from: move.from, to: move.to });
  }
  return { conversions, moves, stops, leftovers: leftovers.sort(byName), registry, replaces };
}

/**
 * 宣言の点を書き換える(鍵を新しい名前に、dir を plugs: true に)。消す点(adminBulkActions)は remove に
 * @param {string} path
 * @param {string} text
 * @param {{ rename: Map<string, string>, remove: Set<string>, itemsOf?: Map<string, string> }} edits itemsOf = 点 → 同じフォルダを読む主の点の新しい名前
 * @returns {{ text: string, removedSpecs: Record<string, string>, left: number }}
 */
export function rewriteDeclaration(path, text, { rename, remove, itemsOf = new Map() }) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  /** @type {ts.ObjectLiteralExpression | null} */
  let object = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      let init = d.initializer;
      // `{ … } as const`・`satisfies` の包みは外して読む(user・wallet・userProfile の宣言)
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init))) init = init.expression;
      if (ts.isIdentifier(d.name) && d.name.text === "extensionPoints" && init && ts.isObjectLiteralExpression(init)) object = init;
    }
  }
  if (!object) return { text, removedSpecs: {}, left: -1 };
  /** @type {{ start: number, end: number, value: string }[]} */
  const cuts = [];
  /** @type {Record<string, string>} */
  const removedSpecs = {};
  let left = 0;
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) continue;
    const name = property.name.text;
    if (remove.has(name)) {
      removedSpecs[name] = property.initializer.getText(source);
      // 行ごと消す(前の行コメントも)。後ろの , と改行も
      const fullStart = property.getFullStart();
      let end = property.getEnd();
      if (text.charAt(end) === ",") end += 1;
      if (text.charAt(end) === "\n") end += 1;
      const lineStart = text.lastIndexOf("\n", property.getStart(source) - 1) + 1;
      const commentStart = text.slice(fullStart, lineStart).trim() === "" ? lineStart : fullStart + (text.slice(fullStart).match(/^\s*\n/)?.[0].length ?? 0);
      cuts.push({ start: commentStart, end, value: "" });
      continue;
    }
    left += 1;
    if (!rename.has(name)) continue;
    cuts.push({ start: property.name.getStart(source), end: property.name.getEnd(), value: rename.get(name) ?? name });
    if (!ts.isObjectLiteralExpression(property.initializer)) continue;
    for (const field of property.initializer.properties) {
      if (ts.isPropertyAssignment(field) && ts.isIdentifier(field.name) && field.name.text === "dir") {
        const of = itemsOf.get(name);
        cuts.push({ start: field.getStart(source), end: field.getEnd(), value: of ? `plugs: true, itemsOf: ${JSON.stringify(of)}` : "plugs: true" });
      }
    }
  }
  let out = text;
  for (const cut of cuts.sort((a, b) => b.start - a.start)) out = out.slice(0, cut.start) + cut.value + out.slice(cut.end);
  return { text: out, removedSpecs, left };
}

/** 空になったフォルダを上へ消す(stop まで) */
function pruneEmpty(root, dir, stop) {
  let current = dir;
  while (current.startsWith(`${stop}/`) && existsSync(join(root, current)) && readdirSync(join(root, current)).length === 0) {
    rmdirSync(join(root, current));
    current = dirname(current);
  }
}

/** 動かした物(ファイルかフォルダ)の中のソースのファイル(リポのルートからのパス) */
function sourceFilesUnder(root, path) {
  if (!statSync(join(root, path)).isDirectory()) return SOURCE.test(path) ? [path] : [];
  return readdirSync(join(root, path), { withFileTypes: true }).flatMap((e) => sourceFilesUnder(root, `${path}/${e.name}`));
}

const RELATIVE_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bmock\.module\(\s*|\brequire\(\s*)(["'])(\.\.?\/[^"']*)\2/g;

/**
 * 動かしたファイルの相対の import を書き直す(注文 27: 動かす前の場所から解いた先へ)。
 * 動かした項目(フォルダの項目)の中を指す物はそのまま、src の下を指す物は @/ の別名、ほかは新しい場所からの相対
 * @param {string} text
 * @param {string} fromFile 動かす前のファイルのパス
 * @param {string} toFile 動かした後のファイルのパス
 * @param {string} movedFrom 動かした項目の元のパス(フォルダの項目ならそのフォルダ)
 */
export function rewriteRelativeImports(text, fromFile, toFile, movedFrom) {
  return text.replace(RELATIVE_SPECIFIER, (all, head, quote, spec) => {
    const target = posix.normalize(posix.join(posix.dirname(fromFile), spec));
    if (target === movedFrom || target.startsWith(`${movedFrom}/`)) return all;
    if (target.startsWith("src/")) return `${head}${quote}@/${target.slice("src/".length)}${quote}`;
    let rel = posix.relative(posix.dirname(toFile), target);
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `${head}${quote}${rel}${quote}`;
  });
}

/**
 * 計画を書く(止めた物は書かない)
 * @param {string} root
 * @param {ReturnType<typeof planPlugs>} plan
 */
export function applyPlugs(root, plan) {
  const moved = [];
  for (const m of plan.moves) {
    for (const pair of [{ from: m.from, to: m.to }, ...m.companions]) {
      mkdirSync(dirname(join(root, pair.to)), { recursive: true });
      renameSync(join(root, pair.from), join(root, pair.to));
      moved.push(pair.to);
      for (const file of sourceFilesUnder(root, pair.to)) {
        const fromFile = pair.from + file.slice(pair.to.length);
        const text = readFileSync(join(root, file), "utf8");
        const next = rewriteRelativeImports(text, fromFile, file, pair.from);
        if (next !== text) writeFileSync(join(root, file), next);
      }
    }
  }
  for (const r of plan.registry) {
    // 行き先が無ければフォルダごと、あれば中身を 1 つずつ(同じ名前は計画で止めてある)
    const pairs = r.merge ? readdirSync(join(root, r.from)).map((entry) => ({ from: `${r.from}/${entry}`, to: `${r.to}/${entry}` })) : [{ from: r.from, to: r.to }];
    mkdirSync(join(root, r.merge ? r.to : dirname(r.to)), { recursive: true });
    for (const pair of pairs) {
      renameSync(join(root, pair.from), join(root, pair.to));
      moved.push(pair.to);
      for (const file of sourceFilesUnder(root, pair.to)) {
        const fromFile = pair.from + file.slice(pair.to.length);
        const text = readFileSync(join(root, file), "utf8");
        const next = rewriteRelativeImports(text, fromFile, file, r.from);
        if (next !== text) writeFileSync(join(root, file), next);
      }
    }
    if (r.merge) rmdirSync(join(root, r.from));
  }
  const declarations = new Map();
  for (const c of plan.conversions) {
    const entry = declarations.get(c.declaredIn) ?? { rename: new Map(), remove: new Set(), itemsOf: new Map() };
    if (c.merged) entry.remove.add(c.from);
    else entry.rename.set(c.from, c.to);
    if (c.itemsOf) entry.itemsOf.set(c.from, c.itemsOf);
    declarations.set(c.declaredIn, entry);
  }
  /** @type {string | null} */
  let adminBulkSpec = null;
  const written = [];
  for (const [path, edits] of declarations) {
    const result = rewriteDeclaration(path, readFileSync(join(root, path), "utf8"), edits);
    adminBulkSpec ??= result.removedSpecs[ADMIN_BULK_POINT] ?? null;
    if (result.left === 0 && edits.remove.size > 0) unlinkSync(join(root, path));
    else writeFileSync(join(root, path), result.text);
    written.push(path);
  }
  // adminBulkActions の 1 点を admin の宣言へ(まだ無ければ)
  const adminPath = `${ADMIN_BULK_OWNER}/extensionPoints.ts`;
  if (adminBulkSpec && existsSync(join(root, adminPath))) {
    const text = readFileSync(join(root, adminPath), "utf8");
    if (!new RegExp(`\\b${ADMIN_BULK_POINT}\\s*:`).test(text)) {
      const spec = adminBulkSpec.replace(/\bdir:\s*["'][^"']*["']/, "plugs: true");
      const line = `  // 管理の一覧の一括操作: <ドメイン>/plugs/${ADMIN_BULK_POINT}/<名前>.tsx(項目のドメインの一覧に効く、注文 24 Q2)\n  ${ADMIN_BULK_POINT}: ${spec},\n`;
      writeFileSync(join(root, adminPath), text.replace(/\n}( as const)?;\s*$/, (_, asConst) => `\n${line}}${asConst ?? ""};\n`));
      written.push(adminPath);
    }
  }
  // 動かしたフォルダの中の差替点の既定: 宣言の default("src/…")と type.from("@/…")を新しい置き場に
  for (const r of plan.replaces) {
    const text = readFileSync(join(root, r.declaredIn), "utf8");
    const at = (path) => `@/${path.slice("src/".length)}`;
    const next = text.split(`"${r.from}/`).join(`"${r.to}/`).split(`"${at(r.from)}/`).join(`"${at(r.to)}/`);
    if (next !== text) {
      writeFileSync(join(root, r.declaredIn), next);
      if (!written.includes(r.declaredIn)) written.push(r.declaredIn);
    }
  }
  for (const dir of new Set(plan.moves.map((m) => dirname(m.from)))) pruneEmpty(root, dir, "src/domains");
  return { moved, written };
}

function main() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const apply = args.includes("--apply");
  const owners = Object.fromEntries(args.flatMap((a, i) => (a === "--owner" && args[i + 1] ? [args[i + 1].split("=")] : [])));
  const onlyAt = args.indexOf("--only");
  const only = onlyAt >= 0 && args[onlyAt + 1] ? args[onlyAt + 1].split(",").map((o) => o.replace(/\/$/, "")) : null;
  const plan = planPlugs(root, { owners, only });
  const result = { mode: apply ? "apply" : "dry-run", ...plan };
  if (apply) Object.assign(result, applyPlugs(root, plan));
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`[plugs] ${result.mode}`);
  console.log(`点の書き換え: ${plan.conversions.length} 点`);
  for (const c of plan.conversions) console.log(`  ${c.owner} ${c.from} → ${c.merged ? `${c.merged} の ${c.to}(1 点にまとめる)` : c.to}${c.itemsOf ? `(itemsOf ${c.itemsOf})` : ""}${c.features.length ? `(生成器に要る欄: ${c.features.join("・")})` : ""}`);
  console.log(`項目の移動: ${plan.moves.length} 件`);
  for (const m of plan.moves) console.log(`  ${m.from} → ${m.to}(${m.rule}${m.reads.length ? `、reads ${m.reads.join("・")}` : ""}${m.companions.length ? `、一緒に ${m.companions.length}` : ""})`);
  console.log(`止めた物(動かさない): ${plan.stops.length} 件`);
  for (const s of plan.stops) console.log(`  ${s.path}: ${s.text}${s.candidates.length ? `(候補 ${s.candidates.join("・")}、--owner ${s.path}=<フォルダ>)` : ""}`);
  console.log(`残る物(受け口の README・複数の項目のテスト): ${plan.leftovers.length} 件`);
  for (const l of plan.leftovers) console.log(`  ${l}`);
  console.log(`差替点の既定のパスの書き換え: ${plan.replaces.length} 点`);
  for (const r of plan.replaces) console.log(`  ${r.declaredIn} ${r.point}: ${r.from}/ → ${r.to}/`);
  console.log(`登録表の項目のフォルダ(messages・recordTargets → plugs/、注文 29): ${plan.registry.length} 件`);
  for (const r of plan.registry) console.log(`  ${r.from}/ → ${r.to}/(項目 ${r.items.length})`);
  if (apply) console.log("次: pnpm generate extensions・pnpm generate registry・pnpm generate district-map");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
