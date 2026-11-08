// scripts/workflow/peer/ack.mjs — pnpm workflow peer ack(本体は lib.cli.mjs の runAck。説明: scripts/workflow/peer/README.md)
import { runAck } from "./lib.cli.mjs";

process.exitCode = runAck(process.argv.slice(2));
