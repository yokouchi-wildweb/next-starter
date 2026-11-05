// scripts/runner/gates/scan.mjs — 門の一覧(gates.json)と各対象フォルダの gate.json を読み、検証して回す順に並べる
// 走査は毎回(一覧は生成しない)。対象 = scripts/structure/*/gate.json と scripts/workflow/*/gate.json。
// 順序: after を満たす順。同じ段では上流の名簿(gates.json の upstreamFolders)の物が先で名前順、名簿に無い(fork の)フォルダは
// 上流の全部の後に名前順(fork の物は上流の後: fork の after に上流の名を書いてもよい)。欄の規則: README.md
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const KINDS = ["structure", "workflow"];
export const KEYS = ["check", "generate", "gates", "after", "watch", "features"];

export class GateError extends Error {}

/** 門の一覧: { gates: { <名前>: { runs, offline } }, upstreamFolders: { structure: [], workflow: [] } } */
export function loadGates(scriptsDir) {
  const p = join(scriptsDir, "runner/gates/gates.json");
  if (!existsSync(p)) throw new GateError(`門の一覧 ${p} が無い`);
  return JSON.parse(readFileSync(p, "utf8"));
}

const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);

/** 1 枚の gate.json を検証する(理由の配列、空 = 正しい) */
export function validate(decl, dir, gateNames) {
  const errs = [];
  if (decl === null || typeof decl !== "object" || Array.isArray(decl)) return ["gate.json がオブジェクトでない"];
  for (const k of Object.keys(decl)) if (!KEYS.includes(k)) errs.push(`知らない欄 ${k}`);
  if (decl.check === undefined && decl.generate === undefined) errs.push("check か generate のどちらかが要る");
  for (const k of ["check", "generate"]) {
    if (decl[k] === undefined) continue;
    if (typeof decl[k] !== "string" || /[/\\]/.test(decl[k])) errs.push(`${k} はこのフォルダの中のファイル名(${JSON.stringify(decl[k])})`);
    else if (!existsSync(join(dir, decl[k]))) errs.push(`${k} のファイル ${decl[k]} が無い`);
  }
  for (const k of ["gates", "after", "watch", "features"]) if (decl[k] !== undefined && !strings(decl[k])) errs.push(`${k} は文字列の配列`);
  for (const g of decl.gates ?? []) if (!gateNames.includes(g)) errs.push(`知らない門 ${g}(門は ${gateNames.join(", ")})`);
  return errs;
}

/** 対象を走査して検証する: [{ kind, name, dir, decl, upstream }]。誤りは GateError(全部まとめて) */
export function scanTargets(scriptsDir, gates) {
  const gateNames = Object.keys(gates.gates);
  const targets = [];
  const errs = [];
  for (const kind of KINDS) {
    const base = join(scriptsDir, kind);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base).sort()) {
      const dir = join(base, name);
      if (!statSync(dir).isDirectory() || !existsSync(join(dir, "gate.json"))) continue;
      let decl;
      try {
        decl = JSON.parse(readFileSync(join(dir, "gate.json"), "utf8"));
      } catch (e) {
        errs.push(`${kind}/${name}/gate.json: JSON が読めない(${e.message})`);
        continue;
      }
      for (const e of validate(decl, dir, gateNames)) errs.push(`${kind}/${name}/gate.json: ${e}`);
      targets.push({ kind, name, dir, decl, upstream: (gates.upstreamFolders?.[kind] ?? []).includes(name) });
    }
  }
  const names = new Set(targets.map((t) => t.name));
  const dup = targets.map((t) => t.name).filter((n, i, a) => a.indexOf(n) !== i);
  for (const n of new Set(dup)) errs.push(`対象の名前 ${n} が structure と workflow の両方にある`);
  for (const t of targets) for (const a of t.decl.after ?? []) if (!names.has(a)) errs.push(`${t.kind}/${t.name}/gate.json: after の ${a} が無い`);
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
