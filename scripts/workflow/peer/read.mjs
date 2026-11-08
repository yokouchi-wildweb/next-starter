// scripts/workflow/peer/read.mjs — pnpm workflow peer read(本体は lib.cli.mjs の runRead。説明: scripts/workflow/peer/README.md)
import { runRead } from "./lib.cli.mjs";

process.exitCode = runRead(process.argv.slice(2));
