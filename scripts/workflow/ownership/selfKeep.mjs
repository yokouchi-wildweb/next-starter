// scripts/workflow/ownership/selfKeep.mjs — pnpm workflow ownership selfKeep --pre=<rev> --target=<rev> [--apply] [--json]
// /flux の区間の merge の後、型 5 self を取り込みの前の自分の版に戻す(本体は src/lib/forkOwnership/selfKeep.mjs の runSelfKeepCli)
import { runSelfKeepCli } from "../../../src/lib/forkOwnership/node.mjs";

runSelfKeepCli();
