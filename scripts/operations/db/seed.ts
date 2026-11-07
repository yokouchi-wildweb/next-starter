// scripts/operations/db/seed.ts — pnpm ops db seed [--all]: デモ・初期データを入れる(本体は scripts/runner/seed/run.ts)
// 既定は対話で項目を選ぶ、--all で全部(閉じた機能の項目は外す)。env ファイルは ENV_FILE(既定 .env.development)。
// 入口は計画書 07 で seed.ts = defineSeed のランナーに作り直す時に見直す
process.env.ENV_FILE ??= ".env.development";
void import("../../runner/seed/run");
