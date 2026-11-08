// scripts/workflow/agent-terminal/lib.waiter.mjs <compact|continue> <text> [prev idle] — 裏で待って、自分のペインの入力欄に 1 行打つ役
//
// hook.mjs(continue)と compactSelf.mjs(compact)が detached で残す。打つのは次がそろったときだけ:
//   - compact: 予約したときの返答が終わった(Stop の印 idle が予約時の値 <prev idle> から変わった)
//   - 入力欄が画面にあって空(人の下書き・確認の画面・作業中の表示には打たない。lib.mjs boxText)
// 打たずにやめるとき(どれも typein.log に 1 行):
//   - そのペインの会話が変わった(/clear・別の claude。SessionStart の印 session が予約時と違う)
//   - ペインが無くなった / 同じ purpose の新しい予約に代わった
//   - 人が自分の言葉を送った(返答の始まりの印 busy が変わった。その番のための 1 行は要らなくなった)
//   - 入力欄が空かないまま AGENT_TERMINAL_WAIT 秒(既定 600)過ぎた
// 説明: scripts/workflow/agent-terminal/README.md

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

import { boxText, currentPane, log, marks, oneLine, paneDir, tmux } from "./lib.mjs";

const [purpose = "", rawText = "", prevIdle = ""] = process.argv.slice(2);
const text = oneLine(rawText);
const STEP_MS = Number(process.env.AGENT_TERMINAL_STEP_MS) || 1000;
const BOX_WAIT_MS = (Number(process.env.AGENT_TERMINAL_WAIT) || 600) * 1000;
const TURN_WAIT_MS = 12 * 3600 * 1000; // 予約した返答が終わるのを待つ上限(それより長い返答は無い前提)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pane = currentPane();
if (!pane || !text || !["compact", "continue"].includes(purpose)) process.exit(0);
const dir = paneDir(pane);
const lock = path.join(dir, `lock.${purpose}`);
const mine = () => {
  try {
    return readFileSync(lock, "utf8").trim() === String(process.pid);
  } catch {
    return false;
  }
};
const done = (outcome) => {
  log(dir, purpose, `${outcome}: ${text}`);
  if (mine()) rmSync(lock, { force: true });
  process.exit(0);
};

try {
  writeFileSync(lock, String(process.pid));
} catch {
  process.exit(0);
}
const start = marks(dir);
const alive = () => tmux(pane, ["display-message", "-p", "-t", pane.pane, "#{pane_id}"]).status === 0;
const check = () => {
  if (!mine()) done("skip: a newer request took over");
  if (marks(dir).session !== start.session) done("skip: another conversation is in the pane now");
  if (!alive()) done("skip: the pane is gone");
};

// 1. compact: 予約した返答の終わりを待つ
if (purpose === "compact") {
  const until = Date.now() + TURN_WAIT_MS;
  while (marks(dir).idle === prevIdle) {
    check();
    if (Date.now() > until) done("skip: the turn did not end");
    await sleep(STEP_MS);
  }
} else {
  await sleep(STEP_MS);
}

// 2. 入力欄が空くのを待って打つ
const b0 = marks(dir).busy;
const until = Date.now() + BOX_WAIT_MS;
let waited = false;
for (;;) {
  check();
  if (marks(dir).busy !== b0) done("skip: the user sent their own words");
  const screen = tmux(pane, ["capture-pane", "-e", "-p", "-t", pane.pane]).stdout ?? "";
  const box = boxText(screen);
  const working = /esc to interrupt/i.test(screen.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ""));
  if (box === "" && !working) break;
  if (!waited) {
    log(dir, purpose, `wait: ${box === null ? "no input box on the screen" : working ? "the session is working" : "the input box is not empty"}`);
    waited = true;
  }
  if (Date.now() > until) done("skip: the input box did not become free");
  await sleep(STEP_MS);
}
if (tmux(pane, ["send-keys", "-t", pane.pane, "-l", "--", text]).status !== 0) done("skip: send failed");
await sleep(500);
tmux(pane, ["send-keys", "-t", pane.pane, "Enter"]);
done("typed");
