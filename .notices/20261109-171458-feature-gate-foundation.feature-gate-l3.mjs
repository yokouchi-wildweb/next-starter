// .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.mjs
// 門番の区切り feature-gate-foundation(機能どうしの依存・ドメインの開閉・入切の値の移動、門番の議会 l3)の fork の移行。
// fork のリポのルートで、上流を取り込んだ後・取り込みのコミットの前(HEAD = 取り込み前の fork)に走らせる。何度走らせても同じ結果になる。
//
//   node .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.mjs            # dry-run(既定、書かない)
//   node .notices/20261109-171458-feature-gate-foundation.feature-gate-l3.mjs --apply    # 書く → pnpm generate extensions
//   --from <rev>(取り込み前の fork の版。既定 HEAD。入切の値を読む)| --json(機械向けの出力)
//
// 1. 規則のキー features: → domains:(src/featureGate/rules/<名前>.ts。中身はそのまま、D33)
// 2. fork の規則の住所が別の規則の前方一致の下にあり、その規則に dependsOn していなければ dependsOn に足す(住所の入れ子 = 依存、D31)。
//    親が一番細かい前方一致の規則。dependsOn が文字列リテラルの配列でない規則は止めて一覧に出す
// 3. 入切の値の移し(D35): 取り込み前(--from)の規則の enabled が読んでいた値(APP_FEATURES の鍵・LEGAL_CONFIG.pages・PAIRED_DEVICE_CONFIG.enabled・
//    ドメインの <X>_CONFIG.enabled = config.ts の既定と src/config/features/<名前>.config.ts の上書き)を読み、今の規則の既定(defaultEnabled、省略 = 開)と
//    違う物を src/config/featureGate/switches.config.ts の `<機能の名前>: true|false` に書く。fork 自身の規則で enabled が <X>_CONFIG.enabled を読む物は
//    defaultEnabled: <その値> に書き換える。式で読む物(&&・関数・別の値)は止めて一覧に出す
// 4. domain.json の closable を消す(D26。閉じられる形の印はなくなった)
// 5. required/coupon.ts があり required/couponAttributionReward.ts が無ければ足す(紹介の報酬はクーポンから外れた自分の機能、D29)
// 6. 上流で消えた入切の鍵を読む fork のコード(規則の外)を一覧に出す(gate.enabled("<機能>") に直す。機械では直さない)
//
// 手順: 上流を取り込む(衝突は上流の版を採る)→ dry-run → 止めた物を確かめる → --apply → pnpm generate extensions・pnpm generate district-map →
// FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies・pnpm check extensions・pnpm typecheck → 取り込みのコミット。
// 手で直す物が残れば exit 2

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

export const RULES_DIR = "src/featureGate/rules";
export const SWITCHES_FILE = "src/config/featureGate/switches.config.ts";
export const REQUIRED_DIR = "src/featureGate/required";

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

// ---- 1. features: → domains: ----

/** 規則の本文の features: を domains: に(コメントの中は変えない)。変えなければ同じ本文 */
export function renameFeaturesKey(text) {
  return text
    .split("\n")
    .map((line) => (/^\s*\/\//.test(line) ? line : line.replace(/(^|[{,\s])features(\s*:\s*\[)/, "$1domains$2")))
    .join("\n");
}

// ---- 規則の字面の読み ----

/** export const rule = { … } の直下の欄(字面) */
export function readRuleFields(text) {
  const body = stripComments(text);
  const list = (field) => {
    const m = new RegExp(`(?:^|[{,\\s])${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`).exec(body);
    if (!m) return new RegExp(`(?:^|[{,\\s])${field}\\s*:`).test(body) ? null : [];
    const out = [];
    for (const part of m[1].split(",").map((p) => p.trim()).filter(Boolean)) {
      const lit = /^["'`]([^"'`$]+)["'`]$/.exec(part);
      if (lit) out.push(lit[1]);
    }
    return out;
  };
  const enabled = /(?:^|[{,\s])enabled\s*:\s*([^\n]*)/.exec(body)?.[1]?.replace(/[\s,;}]+$/, "").trim() ?? null;
  return { pathPatterns: list("pathPatterns") ?? [], dependsOn: list("dependsOn"), enabled };
}

const normalize = (pattern) => {
  const body = pattern.startsWith("=") ? pattern.slice(1) : pattern;
  return body.length > 1 && body.endsWith("/") ? body.slice(0, -1) : body;
};
const covers = (parent, path) => !parent.startsWith("=") && path !== normalize(parent) && path.startsWith(`${normalize(parent)}/`);

// ---- 2. 入れ子の dependsOn ----

/**
 * fork の規則の入れ子の依存を足す計画(純関数)
 * @param {{ name: string, text: string, fork: boolean }[]} rules 全規則(fork = fork が足した規則)
 * @returns {{ add: { name: string, parent: string, path: string }[], stopped: string[] }}
 */
export function planNestedDepends(rules) {
  const read = rules.map((r) => ({ ...r, fields: readRuleFields(r.text) }));
  const reach = (name, seen = new Set()) => {
    if (seen.has(name)) return seen;
    seen.add(name);
    for (const dep of read.find((r) => r.name === name)?.fields.dependsOn ?? []) reach(dep, seen);
    return seen;
  };
  const add = [];
  const stopped = [];
  for (const rule of read.filter((r) => r.fork)) {
    for (const pattern of rule.fields.pathPatterns) {
      const path = normalize(pattern);
      const parents = read
        .filter((other) => other.name !== rule.name)
        .flatMap((other) => other.fields.pathPatterns.filter((p) => covers(p, path)).map((p) => ({ name: other.name, len: normalize(p).length })))
        .sort((a, b) => b.len - a.len);
      const parent = parents[0];
      if (!parent) continue;
      const planned = add.filter((a) => a.name === rule.name).map((a) => a.parent);
      if (reach(rule.name).has(parent.name) || planned.includes(parent.name)) continue;
      if (rule.fields.dependsOn === null) {
        stopped.push(`${RULES_DIR}/${rule.name}.ts: 住所 ${path} が ${parent.name} の下にあるが dependsOn が文字列リテラルの配列でない(dependsOn に "${parent.name}" を手で足す)`);
        continue;
      }
      add.push({ name: rule.name, parent: parent.name, path });
    }
  }
  return { add, stopped };
}

/** 規則の本文の dependsOn に names を足す(無ければ export const rule = { の次の行に) */
export function addDependsOn(text, names) {
  if (names.length === 0) return text;
  const quoted = names.map((n) => `"${n}"`);
  const existing = /(^|\n)(\s*)dependsOn\s*:\s*\[([^\]]*)\]/.exec(text);
  if (existing) {
    const inner = existing[3].trim().replace(/,\s*$/, "");
    const merged = inner === "" ? quoted.join(", ") : `${inner}, ${quoted.join(", ")}`;
    return text.replace(existing[0], `${existing[1]}${existing[2]}dependsOn: [${merged}]`);
  }
  const head = /export\s+const\s+rule\b[^=]*=\s*\{\n?/.exec(text);
  if (!head) return null;
  const at = head.index + head[0].length;
  const nl = head[0].endsWith("\n") ? "" : "\n";
  return `${text.slice(0, at)}${nl}  // 住所が親の機能の住所の下にある(入れ子 = 依存、codemod feature-gate-l3 が足した)\n  dependsOn: [${quoted.join(", ")}],\n${text.slice(at)}`;
}

// ---- 3. 入切の値 ----

/** TypeScript のオブジェクトのリテラルから鍵の道筋の真偽のリテラルを読む(無い・式なら undefined) */
export function readBooleanAt(text, exportName, keyPath, { defaultExport = false } = {}) {
  const source = ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true);
  let root = null;
  const unwrap = (node) => {
    while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isParenthesizedExpression(node))) node = node.expression;
    return node;
  };
  for (const st of source.statements) {
    if (defaultExport && ts.isExportAssignment(st)) root = unwrap(st.expression);
    if (!defaultExport && ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (d.name.getText(source) === exportName) root = unwrap(d.initializer);
    }
  }
  let node = root;
  for (const key of keyPath) {
    if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
    const prop = node.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(source).replace(/["']/g, "") === key);
    node = prop ? unwrap(prop.initializer) : undefined;
  }
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

/**
 * 取り込み前の規則の enabled の式から fork の値を読む(純関数: 読み手を渡す)
 * @param {string} expr enabled の字面(例 "() => APP_FEATURES.wallet.enabled")
 * @param {string} ruleText 取り込み前の規則の本文(import を見る)
 * @param {(path: string) => string | null} readOld 取り込み前の版のファイル
 * @returns {{ value: boolean, source: string } | { problem: string } | null} null = 入切を読まない(() => true など)
 */
export function oldSwitchValue(expr, ruleText, readOld) {
  if (expr === null || /^\(\)\s*=>\s*true$/.test(expr)) return null;
  if (/^\(\)\s*=>\s*false$/.test(expr)) return { value: false, source: "() => false" };
  const m = /^\(\)\s*=>\s*([A-Z][A-Z0-9_]*)((?:\.[A-Za-z0-9_]+)+)$/.exec(expr);
  if (!m) return { problem: `enabled が 1 つの値を読む形でない(${expr})` };
  const [, constName, chain] = m;
  const keys = chain.slice(1).split(".");
  const imported = new RegExp(`import\\s*\\{[^}]*\\b${constName}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`).exec(ruleText)?.[1];
  if (!imported) return { problem: `${constName} の import が読めない` };
  const fileOf = (spec) => {
    const rel = spec.replace(/^@\//, "src/");
    const cands = [`${rel}.ts`, `${rel}/index.ts`, `${rel.replace(/^src\/features\/(?!core\/)/, "src/features/core/")}.ts`];
    return cands.find((c) => readOld(c) !== null) ?? null;
  };
  const file = fileOf(imported);
  if (!file) return { problem: `${imported} が取り込み前の版に無い` };
  const text = readOld(file);
  const direct = readBooleanAt(text, constName, keys);
  if (direct !== undefined) return { value: direct, source: `${file} の ${constName}.${keys.join(".")}` };
  // defineConfig の合成(既定 + 上書き src/config/features/<名前>.config.ts)
  const overrideSpec = /^\s*import\s+[A-Za-z_$][\w$]*\s*(?:,\s*\{[^}]*\})?\s*from\s*["'](@\/config\/features\/[^"']+)["']/m.exec(text)?.[1];
  const defaults = readBooleanAt(text, "defaults", keys);
  const overrideFile = overrideSpec ? `${overrideSpec.replace(/^@\//, "src/")}.ts` : null;
  const overridden = overrideFile && readOld(overrideFile) !== null ? readBooleanAt(readOld(overrideFile), "", keys, { defaultExport: true }) : undefined;
  if (overridden !== undefined) return { value: overridden, source: `${overrideFile} の ${keys.join(".")}` };
  if (defaults !== undefined) return { value: defaults, source: `${file} の既定 ${keys.join(".")}` };
  return { problem: `${file} の ${constName}.${keys.join(".")} がリテラルの真偽でない` };
}

/**
 * switches.config.ts の default export に `<名前>: value` を書く(あれば書き換え)。
 * 行の頭の export default だけを見る(上流の頭のコメントの例 `export default { … }` には書かない。setEnabled.ts の rewriteSwitch と同じ)
 */
export function writeSwitch(text, name, value) {
  const head = /^[ \t]*export\s+default\s*\{/m.exec(text);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  const close = text.indexOf("}", open);
  const inner = text.slice(open + 1, close);
  const re = new RegExp(`(^|[\\s{,])${name}\\s*:\\s*(true|false)`);
  if (re.test(inner)) return text.slice(0, open + 1) + inner.replace(re, `$1${name}: ${value}`) + text.slice(close);
  if (inner.trim() === "") return `${text.slice(0, open)}{ ${name}: ${value} }${text.slice(close + 1)}`;
  const items = inner.trim().replace(/,\s*$/, "");
  return `${text.slice(0, open)}{ ${items}, ${name}: ${value} }${text.slice(close + 1)}`;
}

/** 規則の本文の enabled の行を defaultEnabled: value に(fork 自身の規則) */
export function enabledToDefault(text, value) {
  return text.replace(/\n(\s*)enabled\s*:\s*\(\)\s*=>\s*[A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)+\s*,?\s*\n/, `\n$1defaultEnabled: ${value},\n`);
}

// ---- 4. closable ----

/** domain.json の本文から closable の行を消す(無ければ同じ) */
export function removeClosable(text) {
  return text.replace(/\n\s*"closable"\s*:\s*(true|false)\s*,?(?=\n)/, "").replace(/,(\s*\n\s*})/, "$1");
}

// ---- 走らせる ----

function listRules(root) {
  const dir = join(root, RULES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /\.ts$/.test(n) && !/\.test\.ts$/.test(n))
    .map((n) => ({ name: n.replace(/\.ts$/, ""), file: `${RULES_DIR}/${n}` }));
}

function gitShow(root, rev, path) {
  try {
    return execFileSync("git", ["show", `${rev}:${path}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/** 計画を立てる(書かない) */
export async function plan(root, { from = "HEAD", readOld = (p) => gitShow(root, from, p), upstreamRules } = {}) {
  const out = { writes: new Map(), notes: [], stopped: [] };
  const read = (p) => (out.writes.has(p) ? out.writes.get(p) : existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);
  const write = (p, text) => {
    if (text !== null && text !== read(p)) out.writes.set(p, text);
  };
  const rules = listRules(root);
  // fork の規則 = 上流の規則の名前に無い物(既定: このリポの台帳の基準の版の規則。テストは渡す)
  const upstream = upstreamRules ?? (await upstreamRuleNames(root));
  // 1
  for (const r of rules) write(r.file, renameFeaturesKey(read(r.file)));
  // 2
  const nested = planNestedDepends(rules.map((r) => ({ name: r.name, text: read(r.file), fork: !upstream.has(r.name) })));
  out.stopped.push(...nested.stopped);
  for (const r of rules) {
    const names = [...new Set(nested.add.filter((a) => a.name === r.name).map((a) => a.parent))];
    if (names.length === 0) continue;
    const next = addDependsOn(read(r.file), names);
    if (next === null) out.stopped.push(`${r.file}: export const rule = { … } が読めない(dependsOn に ${names.join("・")} を手で足す)`);
    else {
      write(r.file, next);
      out.notes.push(`${r.file}: dependsOn に ${names.join("・")} を足した(住所 ${nested.add.filter((a) => a.name === r.name).map((a) => a.path).join("・")} が親の住所の下)`);
    }
  }
  // 3
  // 取り込み前の上流の規則の enabled の字面 → その機能(fork の規則が上流の入切を読んでいたら dependsOn に直す。手順 6 の案内にも使う)
  const switchOf = new Map();
  for (const r of rules.filter((x) => upstream.has(x.name) && !UPSTREAM_NOT_SWITCH.includes(x.name))) {
    const e = readRuleFields(readOld(r.file) ?? "").enabled;
    const m = e && /^\(\)\s*=>\s*([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)+)$/.exec(e);
    if (m) switchOf.set(m[1], r.name);
  }
  for (const [expr, name] of Object.entries(KNOWN_SWITCH_KEYS)) if (!switchOf.has(expr)) switchOf.set(expr, name);
  let switches = read(SWITCHES_FILE);
  for (const r of rules) {
    // 取り込み前の enabled が入切でない上流の規則(OR は anyOf へ、方法の選べるかは入切でない条件として上流の規則に残る)
    if (upstream.has(r.name) && UPSTREAM_NOT_SWITCH.includes(r.name)) continue;
    const oldText = readOld(r.file);
    if (oldText === null) continue;
    const oldExpr = readRuleFields(oldText).enabled;
    const now = read(r.file);
    const nowFields = readRuleFields(now);
    if (!upstream.has(r.name)) {
      // fork の規則: 上流の入切 1 つを読む → dependsOn に、<X>_CONFIG.enabled(閉じられる形のひな形)→ defaultEnabled に、ほかの条件はそのまま
      const single = oldExpr && /^\(\)\s*=>\s*([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)+)$/.exec(oldExpr)?.[1];
      const parts = oldExpr ? [...oldExpr.matchAll(/[A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)+/g)].map((m) => m[0]) : [];
      const upstreamParts = parts.filter((p) => switchOf.has(p));
      if (single && switchOf.has(single) && nowFields.enabled === oldExpr) {
        const feature = switchOf.get(single);
        const next = addDependsOn(now.replace(/\n\s*enabled\s*:\s*\(\)\s*=>\s*[A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)+\s*,?(?=\n)/, ""), readRuleFields(now).dependsOn?.includes(feature) ? [] : [feature]);
        if (next === null) out.stopped.push(`${r.file}: export const rule = { … } が読めない(enabled の ${single} を dependsOn ["${feature}"] に手で直す)`);
        else {
          write(r.file, next);
          out.notes.push(`${r.file}: enabled(${single} = 上流の機能 ${feature} の入切)→ dependsOn ["${feature}"]`);
        }
        continue;
      }
      if (upstreamParts.length > 0 && nowFields.enabled === oldExpr) {
        out.stopped.push(`${r.file}: enabled(${oldExpr})が上流の機能の入切 ${upstreamParts.map((p) => `${p} = ${switchOf.get(p)}`).join("・")} を式の中で読む。dependsOn に ${[...new Set(upstreamParts.map((p) => `"${switchOf.get(p)}"`))].join("・")} を足し、式からその部分を外す`);
        continue;
      }
      if (single && /_CONFIG$/.test(single.split(".")[0]) && nowFields.enabled === oldExpr) {
        const old = oldSwitchValue(oldExpr, oldText, readOld);
        if (old && !("problem" in old)) {
          write(r.file, enabledToDefault(now, old.value));
          out.notes.push(`${r.file}: enabled → defaultEnabled: ${old.value}(取り込み前の ${old.source}。値を読んでいた config の enabled の鍵は使われなくなる: 手で消す)`);
        }
      }
      continue;
    }
    // 上流の規則: 取り込み前の fork の値が今の既定と違えば switches.config.ts へ
    const old = oldSwitchValue(oldExpr, oldText, readOld);
    if (old === null) continue;
    if ("problem" in old) {
      out.stopped.push(`${r.file}: 取り込み前の入切が読めない: ${old.problem}(値を ${SWITCHES_FILE} の ${r.name} に手で書く)`);
      continue;
    }
    const nowDefault = /(?:^|[{,\s])defaultEnabled\s*:\s*(true|false)/.exec(stripComments(now))?.[1];
    const def = nowDefault === undefined ? true : nowDefault === "true";
    if (old.value === def) continue;
    if (switches === null) {
      out.stopped.push(`${SWITCHES_FILE} が無い(上流を取り込んだか確かめる)`);
      break;
    }
    const next = writeSwitch(switches, r.name, old.value);
    if (next === null) out.stopped.push(`${SWITCHES_FILE} の default export がオブジェクトのリテラルでない(${r.name}: ${old.value} を手で書く)`);
    else {
      switches = next;
      out.notes.push(`${SWITCHES_FILE}: ${r.name}: ${old.value}(取り込み前の ${old.source}、上流の既定 ${def})`);
    }
  }
  if (switches !== null) write(SWITCHES_FILE, switches);
  // 4
  for (const file of walk(root, "src/features").filter((f) => f.endsWith("/domain.json"))) {
    const text = read(file);
    if (text && /"closable"\s*:/.test(text)) {
      write(file, removeClosable(text));
      out.notes.push(`${file}: closable を消した(機能として閉じるなら ${RULES_DIR}/<名前>.ts の規則の domains にこのドメインを入れる)`);
    }
  }
  // 5
  if (existsSync(join(root, REQUIRED_DIR, "coupon.ts")) && !existsSync(join(root, REQUIRED_DIR, "couponAttributionReward.ts"))) {
    write(`${REQUIRED_DIR}/couponAttributionReward.ts`, `// ${REQUIRED_DIR}/couponAttributionReward.ts
// この fork が必ず使う機能(codemod feature-gate-l3 が書いた: 紹介の報酬はクーポンから外れた自分の機能になった、D29)。
// required/coupon.ts があったので一緒に足した。紹介の報酬を使わないなら消して、読む側を gate.enabled("couponAttributionReward") で確かめる

import type { RequiredFeature } from "@/featureGate";

export const required: RequiredFeature = {
  reason: "codemod feature-gate-l3 が書いた(required/coupon.ts から分かれた、要見直し)",
};
`);
    out.notes.push(`${REQUIRED_DIR}/couponAttributionReward.ts を足した(required/coupon.ts があるため)`);
  }
  // 6 規則の外で、上流の機能の入切だった鍵を読むコード(gate で読む)
  const keys = [...switchOf.entries()].map(([expr, name]) => ({ re: new RegExp(`\\b${expr.replace(/\.enabled$/, "").replace(/\./g, "\\.")}(?:\\.enabled)?\\b(?![.\\w])`), expr, name }));
  for (const file of [...walk(root, "src"), ...walk(root, "scripts")].filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f) && !f.startsWith(`${RULES_DIR}/`))) {
    const text = read(file);
    if (!text) continue;
    const hits = keys.filter((k) => k.re.test(text));
    if (hits.length > 0) out.stopped.push(`${file}: 上流の機能の入切だった ${hits.map((h) => `${h.expr}`).join("・")} を読む。gate.enabled / useGate().enabled(${[...new Set(hits.map((h) => `"${h.name}"`))].join("・")})に直す`);
  }
  return out;
}

function walk(root, rel, acc = []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const child = `${rel}/${name}`;
    if (statSync(join(root, child)).isDirectory()) walk(root, child, acc);
    else acc.push(child);
  }
  return acc;
}

/** 上流(台帳の基準の版)の規則の名前。読めなければ、上流が出荷した規則の名前の既知の一覧 */
async function upstreamRuleNames(root) {
  try {
    const { readBaseFiles } = await import(pathToFileURL(join(root, "src/lib/forkOwnership/baseFiles.mjs")).href);
    const base = readBaseFiles(root);
    if (!("problem" in base)) {
      const names = base.files.filter((f) => f.startsWith(`${RULES_DIR}/`) && f.endsWith(".ts")).map((f) => f.slice(RULES_DIR.length + 1, -3));
      // この区切りで上流が足した規則(取り込んだ木にある上流の新しい規則)も上流の物
      return new Set([...names, ...NEW_UPSTREAM_RULES]);
    }
  } catch {
    // 下へ
  }
  return new Set([...KNOWN_UPSTREAM_RULES, ...NEW_UPSTREAM_RULES]);
}

/** 上流の入切の鍵 → 機能(取り込み前の上流の規則が読めないときの控え。古い fork の書き方も含む) */
export const KNOWN_SWITCH_KEYS = {
  "APP_FEATURES.auth.signup.enabled": "signup",
  "APP_FEATURES.user.pauseEnabled": "pause",
  "APP_FEATURES.user.withdrawEnabled": "withdraw",
  "APP_FEATURES.user.enableUserTag": "userTag",
  "APP_FEATURES.adminConsole.enableDemoUser": "adminDemoUsers",
  "APP_FEATURES.adminConsole.enableChatRoomAdmin": "adminChatRooms",
  "APP_FEATURES.adminConsole.enableNotificationTemplates": "adminNotificationTemplates",
  "APP_FEATURES.adminConsole.enableSampleDomain": "sampleDomain",
  "APP_FEATURES.payment.enabled": "payment",
  "APP_FEATURES.wallet.enabled": "wallet",
  "APP_FEATURES.marketing.coupon.enabled": "coupon",
  "APP_FEATURES.marketing.referral.enabled": "referral",
  "APP_FEATURES.marketing.notification.enableAdminBroadcast": "notificationBroadcast",
  "APP_FEATURES.pages.mypage": "pageMypage",
  "APP_FEATURES.pages.mypageAccount.top": "pageMypageAccount",
  "APP_FEATURES.pages.mypageAccount.email": "pageMypageAccountEmail",
  "APP_FEATURES.pages.mypageAccount.password": "pageMypageAccountPassword",
  "APP_FEATURES.pages.mypageAccount.phone": "pageMypageAccountPhone",
  "APP_FEATURES.pages.mypageAccount.profile": "pageMypageAccountProfile",
  "APP_FEATURES.pages.entry": "pageEntry",
  "APP_FEATURES.pages.services": "pageServices",
  "APP_FEATURES.demo.samplePages": "demoPages",
  "APP_FEATURES.demo.login": "demoLogin",
  "LEGAL_CONFIG.pages.terms": "pageTerms",
  "LEGAL_CONFIG.pages.privacyPolicy": "pagePrivacyPolicy",
  "LEGAL_CONFIG.pages.tradelaw": "pageTradelaw",
  "PAIRED_DEVICE_CONFIG.enabled": "pairedDevice",
  "SAMPLE_CONFIG.enabled": "sampleDomain",
};

/** 取り込み前の enabled が入切そのものでなかった上流の規則(値を移さない) */
export const UPSTREAM_NOT_SWITCH = ["mypageOther", "bankTransferReview"];

/** この区切りで上流が足した規則 */
export const NEW_UPSTREAM_RULES = [
  "couponAttributionReward", "demoDeviceFingerprint", "demoPayment", "demoSampleDomain", "mypageInvite", "mypagePause", "mypageWithdraw", "paymentAnalytics", "walletAnalytics",
];
/** 区切りの前の上流の規則(台帳が読めないときの控え) */
export const KNOWN_UPSTREAM_RULES = [
  "adminChatRooms", "adminDemoUsers", "adminNotificationTemplates", "analytics", "bankTransferReview", "chatRoom", "coupon", "demoLogin", "demoPages", "deviceFingerprint",
  "fingerprintChallenge", "interactionTracking", "milestone", "mypageOther", "notification", "notificationBroadcast", "notificationTemplate", "pageEntry", "pageMypage",
  "pageMypageAccount", "pageMypageAccountEmail", "pageMypageAccountPassword", "pageMypageAccountPhone", "pageMypageAccountProfile", "pagePrivacyPolicy", "pageServices",
  "pageTerms", "pageTradelaw", "pairedDevice", "pause", "payment", "referral", "sampleDomain", "signup", "userAcquisition", "userCounter", "userLineProfile", "userTag",
  "userXProfile", "wallet", "withdraw",
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fromIndex = args.indexOf("--from");
  const from = fromIndex >= 0 ? args[fromIndex + 1] : "HEAD";
  const root = process.cwd();
  const result = await plan(root, { from });
  if (args.includes("--json")) {
    console.log(JSON.stringify({ writes: [...result.writes.keys()], notes: result.notes, stopped: result.stopped }, null, 2));
  } else {
    console.log(`書く物 ${result.writes.size}${apply ? "" : "(dry-run、--apply で書く)"}:`);
    for (const file of result.writes.keys()) console.log(`  ${file}`);
    for (const note of result.notes) console.log(`  - ${note}`);
    if (result.stopped.length > 0) {
      console.log(`\n手で直す物 ${result.stopped.length}:`);
      for (const s of result.stopped) console.log(`  - ${s}`);
    }
  }
  if (apply) {
    for (const [file, text] of result.writes) writeFileSync(join(root, file), text);
    if (result.writes.size > 0) spawnSync("pnpm", ["generate", "extensions"], { cwd: root, stdio: "inherit" });
  }
  if (result.stopped.length > 0) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
