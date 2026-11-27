// scripts/operations/room/lib.deploy.ts
//
// ルームの Worker のデプロイの本体。入口(pnpm ops room deploy・pnpm live:room・pnpm live:all)が共通の守り(guardDeploy)を通し
// セーフポイントの位置を出した後に、同じプロセスの中で呼ぶ(子の命令にしない: 守りの 1 回分の許可は親が使って消すので、子がもう一度
// 確認を求めると非対話では通らない。D420)。
//   roomDeployReady: enabled=false → skip(false を返す。使わないフォークで実行しても無害)/ wrangler.toml 無 → 明示エラー
//   deployRoomWorker: Worker の名前(room-server-<repo_id>、workerName.mjs)→ 依存 → 認証 → wrangler deploy --name <名前>
// どれも失敗は理由を出して exit 1

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { realtimeRoomConfig } from "@/lib/realtimeRoom";

import { roomWorkerName, tomlWorkerName } from "./workerName.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const roomDir = path.join(repoRoot, "servers/room");

/** 出せる状態か: enabled=false なら skip の 2 行を出して false、wrangler.toml が無ければ exit 1 */
export function roomDeployReady(): boolean {
  if (!realtimeRoomConfig.enabled) {
    console.log("room: skipped (realtimeRoom の設定 enabled=false)");
    console.log("有効化するには pnpm ops room init を実行し、README の手順に従ってください");
    return false;
  }

  if (!existsSync(path.join(roomDir, "wrangler.toml"))) {
    console.error("✗ servers/room/wrangler.toml がありません。先に pnpm ops room init を実行してください");
    process.exit(1);
  }
  return true;
}

/**
 * Worker を出す(守りとセーフポイントの知らせは呼び手が済ませた後)。名前は repo.json の repo_id から作り --name で渡す
 * (wrangler.toml の name は親から受け継ぐ値なので使わない: その名前のまま出すと親の本番の Worker を黙って置き換える。D490)
 */
export function deployRoomWorker(): void {
  const worker = roomWorkerName(repoRoot);
  if (worker.error !== undefined) {
    console.error(`✗ ${worker.error}`);
    process.exit(1);
  }
  const workerName = worker.name;
  console.log(`→ Worker: ${workerName}(repo.json の repo_id から)`);
  const tomlName = tomlWorkerName(readFileSync(path.join(roomDir, "wrangler.toml"), "utf8"));
  if (tomlName !== null && tomlName !== workerName) {
    console.log(`  servers/room/wrangler.toml の name "${tomlName}" は使いません(REALTIME_ROOM_URL が ${workerName} の URL を指しているか確かめる)`);
  }

  if (!existsSync(path.join(roomDir, "node_modules"))) {
    console.log("→ servers/room の依存をインストールします...");
    execSync("pnpm install --ignore-workspace", { cwd: roomDir, stdio: "inherit" });
  }

  // pnpm 経由だと workspace スキャンの警告ノイズが出るため、wrangler は直接バイナリで呼ぶ
  const wranglerBin = path.join(roomDir, "node_modules/.bin/wrangler");

  // 認証プリフライト: 未認証のまま wrangler deploy に進むと環境によって対話プロンプトで
  // ハングするため、先に明示エラーにする (統合コマンド経由の無人実行を安全に失敗させる)。
  // 注意: wrangler whoami は未認証でも exit 0 を返すため、出力文字列で判定する
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    let whoami = "";
    try {
      whoami = execSync(`${wranglerBin} whoami`, { cwd: roomDir, stdio: "pipe" }).toString();
    } catch {
      whoami = "not authenticated";
    }
    if (/not authenticated/i.test(whoami)) {
      console.error(`✗ Cloudflare 未認証です。どちらかで認証してください:
    pnpm -C servers/room exec wrangler login   # ブラウザで OAuth (手元マシン向け)
    export CLOUDFLARE_API_TOKEN=...            # API トークン (CI / 無人実行向け)`);
      process.exit(1);
    }
  }

  console.log("→ wrangler deploy を実行します...\n");
  try {
    execSync(`${wranglerBin} deploy --name ${workerName}`, { cwd: roomDir, stdio: "inherit" });
  } catch {
    // wrangler が直前に詳細エラーを表示済み。ここではスタックを出さず終了コードのみ返す
    console.error("\n✗ wrangler deploy が失敗しました (上記エラーを参照)");
    process.exit(1);
  }
  console.log("\n✓ デプロイ完了");
}
