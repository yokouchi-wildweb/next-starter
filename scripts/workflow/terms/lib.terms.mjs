// scripts/workflow/terms/lib.terms.mjs — 語の表(terms.json)の読みと、必ず誤りの言い換えの当たりを探す部品(純関数と走査)。入口は check.mjs
//
// 見る所: Tier1 の文脈ファイル(CLAUDE.md・AGENTS.md・.claude/rules/**・.claude/skills/**)と Tier1 の道具(scripts/**・eslint-rules/**・eslint.config.mjs・package.json)
// 見ない所: 表そのものとこのフォルダ(誤りの字面を持つ)・改名の記録(名前が renames.json のファイル)・バイナリ
// 誤りの行の種類: text = 正規表現で本文を探す / identifier = 道具のコードの中の名前(語の境目で一致)
// 誤りの行の範囲 in: context = 文脈ファイルだけ / tools = 道具だけ / both

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const TERMS_FILE = "scripts/workflow/terms/terms.json";
const SELF_DIR = "scripts/workflow/terms/";
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".turbo", "dist", "coverage"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|pdf|zip|gz|mp4|webm|mp3|wav|wasm)$/i;
const CODE = /\.(mjs|cjs|js|ts|tsx|mts|cts)$/;

/** ファイルの置き場の種類: "context" | "tools" | null(見ない) */
export function areaOf(path) {
  if (path.startsWith(SELF_DIR) || /(^|\/)renames\.json$/.test(path) || BINARY.test(path)) return null;
  if (path === "CLAUDE.md" || path === "AGENTS.md" || path.startsWith(".claude/rules/") || path.startsWith(".claude/skills/")) return "context";
  if (path.startsWith("scripts/") || path.startsWith("eslint-rules/") || path === "eslint.config.mjs" || path === "package.json") return "tools";
  return null;
}

/** 表を読み、誤りの行を照らせる形にする */
export function loadTerms(text) {
  const table = JSON.parse(text);
  const wrong = (table.wrong ?? []).map((row) => {
    const source = row.kind === "identifier" ? `(?<![A-Za-z0-9_$])(?:${row.words.join("|")})(?![A-Za-z0-9_$])` : row.pattern;
    return { ...row, regex: new RegExp(source, "g") };
  });
  return { terms: table.terms ?? [], wrong };
}

/**
 * 1 ファイルの当たり(純関数)
 * @returns {{ line: number, found: string, say: string, decisions: string[] }[]}
 */
export function findHits(path, text, wrong) {
  const area = areaOf(path);
  if (!area) return [];
  const hits = [];
  for (const row of wrong) {
    if (row.in !== "both" && row.in !== area) continue;
    if (row.kind === "identifier" && !(area === "tools" && CODE.test(path))) continue;
    row.regex.lastIndex = 0;
    for (const m of text.matchAll(row.regex)) {
      hits.push({ index: m.index, end: m.index + m[0].length, line: text.slice(0, m.index).split("\n").length, found: m[0], say: row.say, decisions: row.decisions ?? [] });
    }
  }
  // 重なる当たりは先の行の 1 つにまとめる(同じ字面に 2 つの形が当たる時)
  const kept = [];
  for (const h of hits) if (!kept.some((k) => h.index < k.end && k.index < h.end)) kept.push(h);
  return kept.sort((a, b) => a.index - b.index).map(({ index: _i, end: _e, ...rest }) => rest);
}

/** 見る所のファイル(root 相対)。only を渡すとその集合に限る(fork: Tier1 の版にあるパスだけ) */
export function listScanned(root, only = null) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    if (statSync(abs).isFile()) {
      out.push(rel);
      return;
    }
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(rel ? `${rel}/${entry.name}` : entry.name);
    }
  };
  for (const start of ["CLAUDE.md", "AGENTS.md", ".claude/rules", ".claude/skills", "scripts", "eslint-rules", "eslint.config.mjs", "package.json"]) walk(start);
  return out.filter((p) => areaOf(p) && (!only || only.has(p))).sort();
}

/** 走査: { path, line, found, say, decisions }[] */
export function scan(root, only = null) {
  const { wrong } = loadTerms(readFileSync(join(root, TERMS_FILE), "utf8"));
  const hits = [];
  for (const path of listScanned(root, only)) {
    const buffer = readFileSync(join(root, path));
    if (buffer.includes(0)) continue;
    for (const hit of findHits(path, buffer.toString("utf8"), wrong)) hits.push({ path, ...hit });
  }
  return hits;
}
