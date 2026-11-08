// scripts/workflow/peer/reply.mjs — pnpm workflow peer reply(本体は lib.cli.mjs の runReply。説明: scripts/workflow/peer/README.md)
import { runReply } from "./lib.cli.mjs";

process.exitCode = runReply(process.argv.slice(2));
