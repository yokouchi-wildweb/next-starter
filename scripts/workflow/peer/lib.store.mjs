// scripts/workflow/peer/lib.store.mjs
//
// 普通のセッション同士の連絡(peer)の受け箱。利用者ごとに 1 か所、リポの外(~/.team・~/.claude・リポの中には置かない)。
//   <root>/boxes/<セッション id>/<連絡 id>.json  — 会話の受け箱(呼び鈴のフックが見張るのは今の会話の箱と、受け持つ箱だけ)
//   <root>/boxes/<種類>/<ID>/<連絡 id>.json      — インスタンス ID の箱(PEER_BOXES で受け持つ。種類は開いた名前)
//   <root>/tmp/                                   — 書きかけ。ここに書いてから受け箱へ rename(見張りには add が 1 回だけ届く)
//   <root>/state/<箱の鍵>/<連絡 id>.json          — 読んだ・返事した(箱の外に置き、印を付けても呼び鈴が鳴らない)
//   <root>/marks/<セッション id>.json             — 印 = フックが書く自分の記録(pid・procStart が今のプロセスと合う時だけ有効)
// ファイルはどれも版 `v` を持つ。説明: scripts/workflow/peer/README.md

import { randomBytes } from "node:crypto";
import { linkSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** ファイルの形式の版。形を変えたら上げ、読む側は知らない版を読まない */
export const FORMAT_VERSION = 1;

/** 受け箱の根: PEER_STATE_DIR → $XDG_STATE_HOME/next-starter/peer → ~/.local/state/next-starter/peer */
export function stateRoot(env = process.env) {
  if (env.PEER_STATE_DIR) return env.PEER_STATE_DIR;
  const base = env.XDG_STATE_HOME || path.join(env.HOME || os.homedir(), ".local", "state");
  return path.join(base, "next-starter", "peer");
}

const SAFE = /^[A-Za-z0-9._-]+$/;
/** 名前の 1 段: SAFE の文字だけ、`.` と `..` は断る(path.join が上のフォルダに正規化してしまうため) */
const safe = (name, what) => {
  if (!SAFE.test(name ?? "") || name === "." || name === "..") throw new Error(`peer: ${what} に使えない名前です: ${name}`);
  return name;
};

/** セッション id の形(UUID)。箱の種類の段はこの形にできない(boxes/<セッション id> と boxes/<種類> が同じフォルダにならないように) */
const SESSION_ID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 箱の鍵: セッション id(1 段)か、インスタンス ID の箱 `<種類>/<ID>`(2 段)。種類は開いた名前(peer は値の一覧を持たない)。
 * 戻り値 = 段の配列。使えない鍵は throw
 */
export function boxSegments(key) {
  const parts = String(key ?? "").split("/");
  if (parts.length === 1) return [safe(parts[0], "セッション id")];
  if (parts.length === 2) {
    const [kind, id] = [safe(parts[0], "箱の種類"), safe(parts[1], "箱の ID")];
    if (SESSION_ID_FORM.test(kind)) throw new Error(`peer: 箱の種類はセッション id の形にできません: ${kind}`);
    return [kind, id];
  }
  throw new Error(`peer: 箱の鍵は <セッション id> か <種類>/<ID> です: ${key}`);
}

/** 使える箱の鍵か(throw しない) */
export function isBoxKey(key) {
  try {
    boxSegments(key);
    return true;
  } catch {
    return false;
  }
}

/** インスタンス ID の箱(2 段)か */
export const isInstanceBox = (key) => isBoxKey(key) && String(key).includes("/");

export const boxDir = (root, key) => path.join(root, "boxes", ...boxSegments(key));
export const stateDir = (root, key) => path.join(root, "state", ...boxSegments(key));
export const markFile = (root, sessionId) => path.join(root, "marks", `${safe(sessionId, "セッション id")}.json`);
export const tmpDir = (root) => path.join(root, "tmp");

/** 連絡 id: m-<UTC の yyyymmddThhmmss>-<16 進 8 桁>(名前の順 = 送った秒の順。重なっても置く時に取り直す: deliver) */
export function newMessageId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  return `m-${stamp}-${randomBytes(4).toString("hex")}`;
}

/** 連絡 id に使えるか(SAFE、. と .. でない。移した元の番号 m<N> も通る) */
export const isMessageId = (id) => typeof id === "string" && SAFE.test(id) && id !== "." && id !== "..";

const readJson = (file) => {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data && data.v === FORMAT_VERSION ? data : null;
  } catch {
    return null;
  }
};

/** 書きかけを tmp/ に書いてから dir/name へ rename する(状態・印: 上書きしてよい物) */
function writeAtomic(root, dir, name, data) {
  mkdirSync(dir, { recursive: true });
  mkdirSync(tmpDir(root), { recursive: true });
  const tmp = path.join(tmpDir(root), `${name}.${process.pid}.${randomBytes(3).toString("hex")}`);
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path.join(dir, name));
}

/**
 * 連絡を箱に置く(上書きしない)。tmp/ に書いてから link で置き、同じ名前があれば:
 *   id を渡していない → 新しい id を振り直して置く / id を渡した(送り直し・移し)→ 置かずに result "exists"
 * message = { from, senderMode, about, replyTo, body }(id・sentAt・v はここで付ける)
 * 戻り値 { message, result: "placed" | "exists" }
 */
export function deliver(root, key, message, now = new Date(), { id } = {}) {
  if (id !== undefined && !isMessageId(id)) throw new Error(`peer: 連絡 id に使えない名前です: ${id}`);
  const dir = boxDir(root, key);
  mkdirSync(dir, { recursive: true });
  mkdirSync(tmpDir(root), { recursive: true });
  for (let tries = 0; tries < 16; tries += 1) {
    const full = {
      v: FORMAT_VERSION,
      id: id ?? newMessageId(now),
      from: message.from,
      senderMode: message.senderMode ?? "unknown",
      about: message.about ?? "",
      replyTo: message.replyTo ?? null,
      body: message.body,
      sentAt: now.toISOString(),
    };
    const tmp = path.join(tmpDir(root), `${full.id}.${process.pid}.${randomBytes(3).toString("hex")}`);
    writeFileSync(tmp, `${JSON.stringify(full, null, 2)}\n`);
    try {
      linkSync(tmp, path.join(dir, `${full.id}.json`));
      return { message: full, result: "placed" };
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
      if (id !== undefined) return { message: getMessage(root, key, id) ?? full, result: "exists" };
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  throw new Error("peer: 連絡 id を取り直しても空きが見つかりませんでした");
}

/** deliver の連絡だけを返す形(id を渡さない置き方) */
export const putMessage = (root, key, message, now = new Date()) => deliver(root, key, message, now).message;

/** 連絡 1 通(無い・版が違う = null) */
export function getMessage(root, sessionId, id) {
  if (!isMessageId(id)) return null;
  return readJson(path.join(boxDir(root, sessionId), `${id}.json`));
}

/** 連絡の状態 { read, replied }(どちらも ISO の時刻か null) */
export function getState(root, sessionId, id) {
  const data = readJson(path.join(stateDir(root, sessionId), `${safe(id, "連絡 id")}.json`));
  return { read: data?.read ?? null, replied: data?.replied ?? null };
}

/** 状態を付ける: key = "read" | "replied" */
export function setState(root, sessionId, id, key, now = new Date()) {
  const next = { ...getState(root, sessionId, id), [key]: now.toISOString() };
  writeAtomic(root, stateDir(root, sessionId), `${id}.json`, { v: FORMAT_VERSION, ...next });
  return next;
}

/** 受け箱の連絡を新しい順に、状態つきで */
export function listBox(root, sessionId) {
  let names;
  try {
    names = readdirSync(boxDir(root, sessionId));
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith(".json"))
    .map((n) => getMessage(root, sessionId, n.slice(0, -5)))
    .filter(Boolean)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((m) => ({ ...m, state: getState(root, sessionId, m.id) }));
}

/** 印を書く(フックが使う)。mark = { sessionId, pid, procStart, cwd, mode, boxes }(boxes = 受け持つインスタンス ID の箱の鍵) */
export function writeMark(root, mark, now = new Date()) {
  const data = { v: FORMAT_VERSION, ...mark, written: now.toISOString() };
  writeAtomic(root, path.join(root, "marks"), `${safe(mark.sessionId, "セッション id")}.json`, data);
  return data;
}

export const readMark = (root, sessionId) => readJson(markFile(root, sessionId));

/** /proc/<pid>/stat の 22 番目の欄(起動の時刻、clock tick)。読めない = null */
export function procStartOf(pid) {
  try {
    const stat = readFileSync(`/proc/${Number(pid)}/stat`, "utf8");
    const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return rest[19] ?? null;
  } catch {
    return null;
  }
}

/**
 * 印が今も有効か: 印があり、その pid のプロセスが同じ起動の時刻で生きている(pid の使い回しを除く)。
 * livePid を渡すと(claude agents --json の行の pid)、それとも合うことを求める
 */
export function markIsValid(mark, { livePid, procStart = procStartOf } = {}) {
  if (!mark || !mark.pid || !mark.procStart) return false;
  if (livePid !== undefined && Number(livePid) !== Number(mark.pid)) return false;
  return String(procStart(mark.pid)) === String(mark.procStart);
}

/** /proc/<pid>/stat の親 pid と /proc/<pid>/comm。読めない = null */
function procParent(pid) {
  try {
    const stat = readFileSync(`/proc/${Number(pid)}/stat`, "utf8");
    return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
  } catch {
    return null;
  }
}
function procComm(pid) {
  try {
    return readFileSync(`/proc/${Number(pid)}/comm`, "utf8").trim();
  } catch {
    return null;
  }
}

/**
 * このプロセスを動かしている claude の pid(先祖をたどり、comm が claude の最初のもの)。見つからない = null。
 * フックも Bash の道具も claude の子孫として動く
 */
export function claudePid(fromPid = process.pid, { parent = procParent, comm = procComm } = {}) {
  let pid = fromPid;
  for (let i = 0; i < 32 && pid && pid > 1; i += 1) {
    if (comm(pid) === "claude") return pid;
    pid = parent(pid);
  }
  return null;
}

/**
 * その箱を受け持つ生きた印(呼び鈴が鳴る相手)。会話の箱 = そのセッションの印、インスタンス ID の箱 = boxes にその鍵を持つ印。
 * 有効なもの(markIsValid)だけ。無い = null
 */
export function holderOf(root, key, { procStart = procStartOf } = {}) {
  if (!isInstanceBox(key)) {
    const mark = readMark(root, key);
    return markIsValid(mark, { procStart }) ? mark : null;
  }
  let names;
  try {
    names = readdirSync(path.join(root, "marks"));
  } catch {
    return null;
  }
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const mark = readJson(path.join(root, "marks", n));
    if (Array.isArray(mark?.boxes) && mark.boxes.includes(key) && markIsValid(mark, { procStart })) return mark;
  }
  return null;
}
