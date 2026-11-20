// scripts/workflow/peer/hold.mjs — pnpm workflow peer hold(本体は lib.cli.mjs の runHold。説明: scripts/workflow/peer/README.md)
import { runHold } from "./lib.cli.mjs";

process.exitCode = runHold(process.argv.slice(2));
