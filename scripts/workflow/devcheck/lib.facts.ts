// scripts/workflow/devcheck/lib.facts.ts
//
// plan / status が共有する、環境から事実を集める部品(読むだけ: 記録を消さない・何も書かない)。純粋な部品は lib.ts
// 規則と使い方: scripts/workflow/devcheck/README.md

import { readFileSync } from "node:fs";
import path from "node:path";

import { checkoutRoot, describeState, invocationDir, isPortAnswering, readState } from "../dev-tab/lib";
import { DevcheckError, countLiveServers, isRecordAlive, loadContext, loadPolicy, scanItems, worktreePaths, type Plan } from "./lib";

const HERE = import.meta.dirname;

/** 方針・項目・文脈・状態を集める(計画の候補は lib.ts の buildPlan が組む) */
export const gatherFacts = async (): Promise<Omit<Plan, "candidates">> => {
  const root = checkoutRoot(invocationDir());
  const context = loadContext(process.env);
  const policy = loadPolicy(HERE);
  const scripts: Record<string, string> = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts ?? {};
  const { items, rejected } = scanItems(path.join(HERE, "items"), root, scripts);
  const record = readState(root);
  const live = record !== null && isRecordAlive(record);
  const server = live ? { line: describeState(record), answering: await isPortAnswering(record.port) } : null;
  const liveServers = countLiveServers(worktreePaths(root));
  return { checkout: root, context, policy, items, rejected, state: { server, liveServers, admin: "unchecked" } };
};

/** 入口の共通の形: --json を読み、DevcheckError は 1 行で exit 2 */
export const runAction = (body: (json: boolean) => Promise<void>): void => {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--json");
  if (unknown.length > 0) {
    console.error(`pnpm workflow devcheck: 知らない引数 ${unknown.join(" ")}(使えるのは --json)`);
    process.exit(2);
  }
  body(args.includes("--json")).catch((error) => {
    if (error instanceof DevcheckError) {
      console.error(`✗ ${error.message}`);
      process.exit(2);
    }
    console.error(`pnpm workflow devcheck: ${(error as Error).message}`);
    process.exit(1);
  });
};
