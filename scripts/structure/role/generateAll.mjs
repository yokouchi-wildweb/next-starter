// scripts/structure/role/generateAll.mjs — 門の入口(pnpm generate role): 全ロール・プロフィールの生成物を作り直す(= pnpm role:generate --all)
import { generateAll } from "./generate.mjs";

generateAll().catch((err) => {
  console.error("エラー:", err.message);
  process.exit(1);
});
