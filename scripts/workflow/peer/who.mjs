// scripts/workflow/peer/who.mjs — pnpm workflow peer who(本体は lib.cli.mjs の runWho。説明: scripts/workflow/peer/README.md)
import { runWho } from "./lib.cli.mjs";

process.exitCode = runWho(process.argv.slice(2));
