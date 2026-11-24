// scripts/structure/cron/phase-check.ts — 段階の入口(pnpm check cron): vercel.json の crons が task.ts からの生成結果と一致するか
// build の段階(PHASE=build)では --vercel-build を付ける(Vercel 上のビルドの時だけ検査する、今の build と同じ)。
// それ以外の段階(ship・deploy・名前指定)は、vercel.json が無ければ飛ばして出す(forge のデプロイ先の検査と同じ。Vercel を使わないリポ)。
// generate の入口は phase-generate.ts(契約のプラン = --plan か repo.json の vercel.plan。どちらも無ければ飛ばす)
import { existsSync } from "node:fs";

if (process.env.PHASE === "build") {
  process.argv.splice(2, 0, "--vercel-build");
  void import("./check");
} else if (!existsSync("vercel.json")) {
  console.log("[cron] vercel.json が無いのでデプロイ先の検査(pnpm check cron)は飛ばした");
} else {
  void import("./check");
}
