// scripts/operations/db/seed.ts — pnpm ops db seed [--all]: デモ・初期データを入れる(本体は scripts/runner/seed/run.ts)
// 既定は対話でドメインを選ぶ、--all で全部(各ドメインの seed.ts、閉じた機能のドメインは飛ばす。src/lib/seed/README.md)。env ファイルは ENV_FILE(既定 .env.development)。
process.env.ENV_FILE ??= ".env.development";
void import("../../runner/seed/run");
