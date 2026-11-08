// scripts/workflow/peer/send.mjs — pnpm workflow peer send(本体は lib.cli.mjs の runSend。説明: scripts/workflow/peer/README.md)
import { runSend } from "./lib.cli.mjs";

process.exitCode = runSend(process.argv.slice(2));
