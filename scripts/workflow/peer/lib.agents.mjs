// scripts/workflow/peer/lib.agents.mjs
//
// 宛先の名前を生きているセッションの中から探す。読むのは `claude agents --json` だけ(外から読む公式の口)。
// 名前・status の無い行は外す(古い形の死んだ記録が pid の使い回しで生きている行として出ることがある)。
// 説明: scripts/workflow/peer/README.md

import { spawnSync } from "node:child_process";
import path from "node:path";

/** `claude agents --json` を読む。読めない = null */
export function readAgents() {
  const r = spawnSync("claude", ["agents", "--json"], { encoding: "utf8", timeout: 15000 });
  if (r.status !== 0) return null;
  try {
    const rows = JSON.parse(r.stdout);
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

/** 宛先になれる行: sessionId・name・status がそろう */
export function liveSessions(rows) {
  return (rows ?? []).filter(
    (r) => r && typeof r.sessionId === "string" && r.sessionId && typeof r.name === "string" && r.name && typeof r.status === "string" && r.status,
  );
}

/** 候補の 1 行に出す形 */
export const describe = (r) => ({
  name: r.name,
  repo: r.cwd ? path.basename(r.cwd) : "-",
  started: Number.isFinite(r.startedAt) ? new Date(r.startedAt).toISOString().replace(/\.\d+Z$/, "Z") : "-",
  status: r.status,
  sessionId: r.sessionId,
  pid: r.pid,
  cwd: r.cwd ?? "",
});

const newestFirst = (a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0);

/**
 * 名前を宛先に決める(selfId = 自分。自分には送らない)。
 *   { kind: "one", target } — 完全一致がちょうど 1 つ
 *   { kind: "many", candidates } — 完全一致が 2 つ以上(新しい順)
 *   { kind: "none", candidates } — 完全一致なし。名前を含む行(無ければ生きている全部)を新しい順に
 */
export function resolveName(rows, name, selfId) {
  const live = liveSessions(rows).filter((r) => r.sessionId !== selfId);
  const exact = live.filter((r) => r.name === name).sort(newestFirst);
  if (exact.length === 1) return { kind: "one", target: describe(exact[0]) };
  if (exact.length > 1) return { kind: "many", candidates: exact.map(describe) };
  const needle = name.toLowerCase();
  const near = live.filter((r) => r.name.toLowerCase().includes(needle));
  return { kind: "none", candidates: (near.length ? near : live).sort(newestFirst).map(describe) };
}

/** セッション id で生きている行を引く(返事の前の生存の確認)。無い = null */
export function findLive(rows, sessionId) {
  const row = liveSessions(rows).find((r) => r.sessionId === sessionId);
  return row ? describe(row) : null;
}

/** 自分の行(名前を from に入れる)。名前・status が無くても引く */
export function findSelf(rows, sessionId) {
  const row = (rows ?? []).find((r) => r && r.sessionId === sessionId);
  return row ? describe({ status: "-", name: "-", ...row }) : null;
}
