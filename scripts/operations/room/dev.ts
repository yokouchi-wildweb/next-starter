// scripts/operations/room/dev.ts
//
// ルームサーバーを手元で起動する (pnpm ops room dev)。servers/room の wrangler dev を呼ぶ
// (servers/room は pnpm workspace の外の別パッケージ。依存が無ければ先に入れる)。
// 引数はそのまま wrangler dev へ渡す(例: pnpm ops room dev --port 8788)。
// 起動した Worker の確かめ: REALTIME_ROOM_URL=http://localhost:8787 REALTIME_ROOM_AUTH_SECRET=<.dev.vars の値> pnpm ops room check

import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const roomDir = path.join(repoRoot, "servers/room");

if (!existsSync(path.join(roomDir, "node_modules"))) {
  console.log("→ servers/room の依存をインストールします...");
  execSync("pnpm install --ignore-workspace", { cwd: roomDir, stdio: "inherit" });
}

// pnpm 経由だと workspace スキャンの警告ノイズが出るため、wrangler は直接バイナリで呼ぶ(deploy.ts と同じ)
const wranglerBin = path.join(roomDir, "node_modules/.bin/wrangler");
const result = spawnSync(wranglerBin, ["dev", ...process.argv.slice(2)], { cwd: roomDir, stdio: "inherit", shell: false });
process.exit(result.status ?? 1);
