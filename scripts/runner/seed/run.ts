// scripts/runner/seed/run.ts — pnpm ops db seed [--all] の本体(入口は scripts/operations/db/seed.ts)
//
// ドメインのシード src/features/<ドメイン>/seed.ts(defineSeed、src/lib/seed)を走査し、after の順に各ドメインのサービスで入れる。
// - 既定は対話でドメインを選ぶ(選んだドメインが after で指すドメインは自動で足す)、--all で全部
// - 閉じた機能のドメイン(そのフォルダを features に持つ規則が閉じている。スイッチを通した rules)は飛ばして名前を出し、
//   それを after に持つシードは理由を出して止める
// - DB が未設定なら何も入れずに止める。$unique の行は既にあれば使い回す(何度打っても同じ)
// 書き方: src/lib/seed/README.md、ランナー: scripts/runner/seed/README.md

import path from "node:path";

import { checkbox } from "@inquirer/prompts";

import { planSeeds } from "../../../src/lib/seed";
import { loadEnvFile, requireDatabase } from "../task/prepare";
import { isUndefinedTableError } from "./gate";
import { insertSeeds, type SeedService } from "./insert";
import { closedByOf, listSeedFiles, loadSeedEntries } from "./scan";

loadEnvFile();

async function main() {
  console.log("🌱 データベースのシード実行");
  console.log("");
  await requireDatabase("pnpm ops db seed");

  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const { rules } = await import("@/featureGate/node");
  const entries = await loadSeedEntries(repoRoot, listSeedFiles(repoRoot), closedByOf(rules));
  const open = entries.filter((entry) => entry.closedBy === null);
  if (open.length === 0) {
    console.log("実行できるシードがありません。終了します。");
    process.exit(0);
  }

  let selected: string[];
  if (process.argv.includes("--all")) {
    selected = entries.map((entry) => entry.domain);
    console.log("📋 全てのシードを実行します");
  } else {
    selected = await checkbox<string>({
      message: "シードを入れるドメインを選んでください（スペースで選択、Enterで確定。after のドメインは自動で足す）",
      choices: open.map((entry) => ({
        name: entry.seed.after?.length ? `${entry.domain} (after: ${entry.seed.after.join(", ")})` : entry.domain,
        value: entry.domain,
        checked: true,
      })),
    });
    if (selected.length === 0) {
      console.log("シードが選択されませんでした。終了します。");
      process.exit(0);
    }
  }

  const plan = planSeeds(entries, selected);
  if (plan.skipped.length > 0) {
    console.log("🔒 閉じた機能のドメインなので飛ばします:");
    for (const { domain, closedBy } of plan.skipped) console.log(`   ${domain}: 閉じた機能 ${closedBy}`);
    console.log("");
  }
  if (plan.problems.length > 0) {
    console.error("❌ シードの置き方に誤りがあるので、何も入れずに止めます:");
    for (const problem of plan.problems) console.error(`   ${problem}`);
    process.exit(1);
  }

  console.log(`📋 実行順序: ${plan.order.map((entry) => entry.domain).join(" → ")}`);
  console.log("");

  // 表 → ドメインのサービス(serviceRegistry。結線は動的 import)
  const { findDomainByTable, getService } = await import("@/wiring/domainRegistry");
  const serviceOf = async (table: string): Promise<SeedService | null> => {
    const domain = findDomainByTable(table);
    return domain ? ((await getService(domain)) as SeedService | undefined) ?? null : null;
  };

  try {
    const report = await insertSeeds(plan.order, serviceOf, (line) => console.log(line));
    const created = report.filter((r) => r.action === "created").length;
    console.log("");
    console.log(`✅ シードの実行が完了しました(入れた ${created} 行 / 既にあった ${report.length - created} 行)`);
  } catch (error) {
    if (isUndefinedTableError(error)) {
      console.error("❌ 書き込む表が DB にありません。開いた機能の表なら pnpm db:push で作る(閉じた機能の表はシードごと飛ばされる)。");
    }
    throw error;
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ シードの実行に失敗しました:", error);
  process.exit(1);
});
