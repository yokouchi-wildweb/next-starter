#!/usr/bin/env node
// scripts/role-config/index.mjs
// ロール設定スクリプトのエントリポイント

import init from "./init.mjs";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "init":
    case undefined:
      await init();
      break;
    default:
      console.log("使用方法:");
      console.log("  pnpm role:init    新しいロール設定を作成");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
