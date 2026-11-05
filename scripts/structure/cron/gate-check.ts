// scripts/structure/cron/gate-check.ts — 門の入口(pnpm check cron): vercel.json の crons が task.ts からの生成結果と一致するか(= pnpm cron:check)
// build の門(GATE=build)では --vercel-build を付ける(Vercel 上のビルドの時だけ検査する、今の build と同じ)。
// それ以外の門(ship・deploy・名前指定)は、vercel.json が無ければ飛ばして出す(forge のデプロイ先の検査と同じ。Vercel を使わないリポ)。
// cron:generate は契約のプラン(--plan hobby|pro)を人が選ぶので generate の入口は置かない
import { existsSync } from "node:fs";

if (process.env.GATE === "build") {
  process.argv.splice(2, 0, "--vercel-build");
  void import("./check");
} else if (!existsSync("vercel.json")) {
  console.log("[cron] vercel.json が無いのでデプロイ先の検査(cron:check)は飛ばした");
} else {
  void import("./check");
}
