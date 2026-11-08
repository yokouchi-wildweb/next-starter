// scripts/workflow/peer/inbox.mjs — pnpm workflow peer inbox(本体は lib.cli.mjs の runInbox。説明: scripts/workflow/peer/README.md)
import { runInbox } from "./lib.cli.mjs";

process.exitCode = runInbox(process.argv.slice(2));
