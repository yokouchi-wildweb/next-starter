// scripts/workflow/agent-terminal/lib.intervene.mjs
//
// /intervene の 1 回分の許可(/allow の許可と同じ形): 人が自分の言葉で許した時に permit.mjs が書き、type.mjs が 1 回使うと消える。
// 次の人の入力(hook.mjs busy = UserPromptSubmit)でも消える = 同じ番の中だけ。別のセッションの連絡(peer)は許可にならない(書く命令を
// 打つのは /intervene スキルだけで、人の言葉を --words に写す)。書く・使う・断る・消すは intervene.log に 1 行ずつ残す。
// 置き場: 記録の置き場(lib.mjs stateRoot)の permits/<会話の id>.json = { v: 1, words, at } と intervene.log
// 説明: scripts/workflow/agent-terminal/README.md

import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stateRoot } from "./lib.mjs";

/** 今の会話の id(無ければ "") */
export const sessionId = (env = process.env) => env.CLAUDE_CODE_SESSION_ID ?? "";

const permitPath = (sid, env) => path.join(stateRoot(env), "permits", `${sid}.json`);

/** 書く・使う・断る・消すの記録: <時刻> <会話の id> <出来事> */
export function record(sid, what, env = process.env) {
  try {
    const dir = stateRoot(env);
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "intervene.log"), `${new Date().toISOString()}\t${sid || "-"}\t${what.replace(/[\t\n]+/g, " ")}\n`);
  } catch {
    // 記録できないだけ
  }
}

/** 今の許可(無い・読めない = null) */
export function readPermit(sid, env = process.env) {
  if (!sid) return null;
  const file = permitPath(sid, env);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data && typeof data.words === "string" ? { words: data.words, at: String(data.at ?? "") } : null;
  } catch {
    return null;
  }
}

/** 許可を書く(1 回分。前の物は置き換える) */
export function writePermit(sid, words, env = process.env, now = new Date()) {
  const file = permitPath(sid, env);
  mkdirSync(path.dirname(file), { recursive: true });
  const data = { v: 1, words, at: now.toISOString() };
  writeFileSync(file, `${JSON.stringify(data)}\n`);
  record(sid, `permit: ${words}`, env);
  return data;
}

/** 許可を消す(使った・次の人の入力)。消した物があれば true */
export function clearPermit(sid, why, env = process.env) {
  if (!sid) return false;
  const file = permitPath(sid, env);
  if (!existsSync(file)) return false;
  rmSync(file, { force: true });
  record(sid, `cleared: ${why}`, env);
  return true;
}
