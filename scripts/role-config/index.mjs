#!/usr/bin/env node
// scripts/role-config/index.mjs
// ロール設定スクリプトのエントリポイント

import init from "./init.mjs";
import toggle from "./toggleRole.mjs";

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  switch (command) {
    case "init":
    case undefined:
      await init();
      break;
    case "toggle": {
      const roleId = args.find((arg) => !arg.startsWith("--"));
      const options = {
        on: args.includes("--on"),
        off: args.includes("--off"),
      };
      await toggle(roleId, options);
      break;
    }
    default:
      console.log("使用方法:");
      console.log("  pnpm role:init              新しいロール設定を作成");
      console.log("  pnpm role:toggle            対話形式でロールを切り替え");
      console.log("  pnpm role:toggle <roleId>   指定ロールをトグル");
      console.log("  pnpm role:toggle <roleId> --on   有効にする");
      console.log("  pnpm role:toggle <roleId> --off  無効にする");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
