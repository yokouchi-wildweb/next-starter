// scripts/runner/phases/scan.mjs — 段階の一覧(phases.json)と各対象フォルダの phase.json を読み、検証して回す順に並べる
// 走査は毎回(一覧は生成しない)。対象 = scripts/structure/*/phase.json と scripts/workflow/*/phase.json。
// 順序: after を満たす順。同じ段では上流の名簿(phases.json の upstreamFolders)の物が先で名前順、名簿に無い(fork の)フォルダは
// 上流の全部の後に名前順(fork の物は上流の後: fork の after に上流の名を書いてもよい)。欄の規則: README.md
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { normalizeGateOutputs } from "../../../src/lib/districtMap/node.mjs";

export const KINDS = ["structure", "workflow"];
export const KEYS = ["check", "generate", "phases", "after", "watch", "features", "outputs", "regions", "tests"];
/** テストのファイルの形(pnpm test の入口と同じ: scripts/runner/test/scan.mjs の TEST_FILE) */
const TEST_FILE = /\.test\.(ts|tsx|mts|mjs|js|cjs)$/;

export class GateError extends Error {}

/** 段階の一覧: { phases: { <名前>: { runs, offline } }, upstreamFolders: { structure: [], workflow: [] } } */
export function loadGates(scriptsDir) {
  const p = join(scriptsDir, "runner/phases/phases.json");
  if (!existsSync(p)) throw new GateError(`段階の一覧 ${p} が無い`);
  return JSON.parse(readFileSync(p, "utf8"));
}

const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);

/** 1 枚の phase.json を検証する(理由の配列、空 = 正しい) */
export function validate(decl, dir, gateNames) {
  const errs = [];
  if (decl === null || typeof decl !== "object" || Array.isArray(decl)) return ["phase.json がオブジェクトでない"];
  for (const k of Object.keys(decl)) if (!KEYS.includes(k)) errs.push(`知らない欄 ${k}`);
  if (decl.check === undefined && decl.generate === undefined) errs.push("check か generate のどちらかが要る");
  for (const k of ["check", "generate"]) {
    if (decl[k] === undefined) continue;
    if (typeof decl[k] !== "string" || /[/\\]/.test(decl[k])) errs.push(`${k} はこのフォルダの中のファイル名(${JSON.stringify(decl[k])})`);
    else if (!existsSync(join(dir, decl[k]))) errs.push(`${k} のファイル ${decl[k]} が無い`);
  }
  for (const k of ["phases", "after", "watch", "features", "regions", "tests"]) if (decl[k] !== undefined && !strings(decl[k])) errs.push(`${k} は文字列の配列`);
  // tests: check が node --test に渡すテストのファイル(リポ相対)。pnpm test はこれと、テストのファイルそのものの check を回さない(段階 1 回、D389)
  if (strings(decl.tests)) {
    for (const f of decl.tests) {
      if (!TEST_FILE.test(f)) errs.push(`tests の ${f} はテストのファイル(*.test.*)でない`);
      else if (!existsSync(join(dir, "../../..", f))) errs.push(`tests の ${f} が無い(リポ相対のパス)`);
    }
  }
  // outputs: 1 行 = glob の文字列(= every-run)か { glob, kind?, source? }(生成器が出力を宣言する唯一の場所。読み方は src/lib/districtMap/domainOutputs.mjs)
  errs.push(...normalizeGateOutputs(decl.outputs).problems);
  for (const g of decl.phases ?? []) if (!gateNames.includes(g)) errs.push(`知らない段階 ${g}(段階は ${gateNames.join(", ")})`);
  return errs;
}

/** 対象を走査して検証する: [{ kind, name, dir, decl, upstream }]。誤りは GateError(全部まとめて) */
export function scanTargets(scriptsDir, gates) {
  const gateNames = Object.keys(gates.phases);
  const targets = [];
  const errs = [];
  for (const kind of KINDS) {
    const base = join(scriptsDir, kind);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base).sort()) {
      const dir = join(base, name);
      if (!statSync(dir).isDirectory() || !existsSync(join(dir, "phase.json"))) continue;
      let decl;
      try {
        decl = JSON.parse(readFileSync(join(dir, "phase.json"), "utf8"));
      } catch (e) {
        errs.push(`${kind}/${name}/phase.json: JSON が読めない(${e.message})`);
        continue;
      }
      for (const e of validate(decl, dir, gateNames)) errs.push(`${kind}/${name}/phase.json: ${e}`);
      targets.push({ kind, name, dir, decl, upstream: (gates.upstreamFolders?.[kind] ?? []).includes(name) });
    }
  }
  const names = new Set(targets.map((t) => t.name));
  const dup = targets.map((t) => t.name).filter((n, i, a) => a.indexOf(n) !== i);
  for (const n of new Set(dup)) errs.push(`対象の名前 ${n} が structure と workflow の両方にある`);
  for (const t of targets) for (const a of t.decl.after ?? []) if (!names.has(a)) errs.push(`${t.kind}/${t.name}/phase.json: after の ${a} が無い`);
  if (errs.length) throw new GateError(errs.join("\n"));
  return order(targets);
}

/** after を満たす順(段ごとに: 上流が先で名前順、fork は上流の全部の後に名前順)。循環は GateError */
export function order(targets) {
  const rank = (t) => (t.upstream ? 0 : 1);
  const cmp = (a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const done = new Set();
  const out = [];
  let rest = [...targets];
  // fork の物は上流の全部の後: 上流を先に全部並べ、その後に fork(fork の after は上流か fork を指せる)
  for (const pass of [0, 1]) {
    let pool = rest.filter((t) => rank(t) === pass);
    while (pool.length) {
      const ready = pool.filter((t) => (t.decl.after ?? []).every((a) => done.has(a))).sort(cmp);
      if (!ready.length) {
        const stuck = pool.map((t) => `${t.name}(after ${(t.decl.after ?? []).join(", ")})`).join(" / ");
        throw new GateError(pass === 0 && pool.some((t) => (t.decl.after ?? []).some((a) => rest.find((r) => r.name === a && rank(r) === 1)))
          ? `上流の対象が fork の対象の後を求めている: ${stuck}`
          : `after が循環している: ${stuck}`);
      }
      const t = ready[0];
      out.push(t);
      done.add(t.name);
      pool = pool.filter((x) => x !== t);
    }
    rest = rest.filter((t) => rank(t) !== pass);
  }
  return out;
}

/** phase.json の tests を読む(その段階の check.mjs が node --test に渡す一覧の唯一の場所): リポ相対のパスの配列 */
export function gateTestsOf(dir) {
  const decl = JSON.parse(readFileSync(join(dir, "phase.json"), "utf8"));
  return decl.tests ?? [];
}

/**
 * 段階が回すテストのファイル: Map<リポ相対のパス, 段階の対象名>。check そのものがテストのファイルの対象(cycles・config)と、
 * tests の欄(notices・rules)。pnpm test は名指しでない時にこれを除く(段階の入口のテストはテストの段で繰り返さない、D389)。
 * 段階の宣言が読めない時は空(テストを減らさない: 誤りは pnpm check が出す)
 */
export function gateTestFiles(repo) {
  const out = new Map();
  let targets;
  try {
    targets = scanTargets(join(repo, "scripts"), loadGates(join(repo, "scripts")));
  } catch {
    return out;
  }
  for (const t of targets) {
    if (typeof t.decl.check === "string" && TEST_FILE.test(t.decl.check)) out.set(`scripts/${t.kind}/${t.name}/${t.decl.check}`, t.name);
    for (const f of t.decl.tests ?? []) out.set(f, t.name);
  }
  return out;
}
