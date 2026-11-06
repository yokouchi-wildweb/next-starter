// scripts/tmux-launch/setup.mjs
//
// pnpm setup:tmux-launch            このマシンに入れる(入っていれば版を合わせ直す)
// pnpm setup:tmux-launch --check    入り具合を出すだけ(全部そろっていれば exit 0、足りなければ 1)
// pnpm setup:tmux-launch --remove   外す
//
// 入れるもの: 中身 = <XDG_DATA_HOME|~/.local/share>/next-starter/claude-tmux.sh / シェルの設定(~/.bashrc か ~/.zshrc)の 1 行 /
// ~/.tmux.conf の塊。どれも印で囲む。終了コード 2 = tmux が無い(何も入れない)
// 説明: scripts/tmux-launch/README.md

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { SOURCE, hasBlock, inspect, rcBody, removeBlock, tmuxConfBody, upsertBlock } from "./lib.mjs";

const arg = process.argv[2] ?? "";
if (!["", "--check", "--remove"].includes(arg)) {
  console.error("使い方: pnpm setup:tmux-launch [--check|--remove]");
  process.exit(1);
}

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
const state = inspect();
const mark = (ok, text) => (ok ? "済" : hasBlock(text) ? "古い" : "未");

if (arg === "--check") {
  console.log(`tmux: ${state.tmux ? "あり" : "なし"}`);
  console.log(`中身: ${state.installedVersion === null ? "未" : `版 ${state.installedVersion}`}(リポの版 ${state.sourceVersion})${state.installedVersion !== null && !state.upToDate ? " → 古い" : ""} ${state.installed}`);
  console.log(`シェルの設定: ${mark(state.rcOk, read(state.rc))} ${state.rc}`);
  console.log(`tmux の設定: ${mark(state.tmuxConfOk, read(state.tmuxConf))} ${state.tmuxConf}`);
  console.log(state.ok ? "→ 入っています" : "→ 足りません: pnpm setup:tmux-launch");
  process.exit(state.ok ? 0 : 1);
}

if (arg === "--remove") {
  for (const file of [state.rc, state.tmuxConf]) {
    const text = read(file);
    const next = removeBlock(text);
    if (next !== text) {
      writeFileSync(file, next);
      console.log(`外しました: ${file} の印の塊`);
    }
  }
  if (existsSync(state.installed)) {
    rmSync(state.installed);
    console.log(`消しました: ${state.installed}`);
  }
  console.log("新しいターミナルから効きます(今のシェルは `unset -f claude` で戻る)");
  process.exit(0);
}

if (!state.tmux) {
  console.error("tmux がありません。入れてからもう一度:");
  console.error("  Debian/Ubuntu/WSL: sudo apt install tmux  |  macOS: brew install tmux");
  process.exit(2);
}

mkdirSync(path.dirname(state.installed), { recursive: true });
copyFileSync(SOURCE, state.installed);
console.log(`中身を置きました(版 ${state.sourceVersion}): ${state.installed}`);

const rcText = read(state.rc);
const rcNext = upsertBlock(rcText, rcBody(state.installed));
if (rcNext !== rcText) {
  writeFileSync(state.rc, rcNext);
  console.log(`シェルの設定に足しました: ${state.rc}`);
}

const confText = read(state.tmuxConf);
const confNext = upsertBlock(confText, tmuxConfBody());
if (confNext !== confText) {
  writeFileSync(state.tmuxConf, confNext);
  console.log(`tmux の設定に足しました: ${state.tmuxConf}`);
}
// 動いている tmux サーバー(いつものもの)があれば設定を読み直させる。無ければ何もしない
if (spawnSync("tmux", ["has-session"], { stdio: "ignore" }).status === 0) {
  spawnSync("tmux", ["source-file", state.tmuxConf], { stdio: "ignore" });
}

console.log("");
console.log("できました。新しいターミナルで claude を打つと tmux の中で開きます(会話の続きは claude --continue)。");
console.log("一時的に外すとき: NO_TMUX_LAUNCH=1 claude");
