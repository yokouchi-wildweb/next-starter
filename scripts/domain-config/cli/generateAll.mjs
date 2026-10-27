// dc:generate:all: ドメインを選び（既定は全件）、各 domain.json の generateFiles か手動選択で一括生成する

import askGenerateFiles from "../questions/generate-files.mjs";
import { runGenerateAll } from "../pipeline/generateAll.mjs";
import { confirm, selectDomains } from "./prompts.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {{ yes?: boolean, only?: string[] | null, dryRun?: boolean }} [options] yes = プロンプトを出さず、全ドメインを各 domain.json の generateFiles どおりに生成する
 *   dryRun = 書かずに一覧（実行の確認も出さない）
 */
export async function runGenerateAllInteractive(workspace, options = {}) {
  const domains = workspace.listDomains();
  if (domains.length === 0) {
    console.log("domain.json を含むドメインが存在しません。");
    return;
  }

  const runOptions = { dryRun: Boolean(options.dryRun) };
  if (options.yes) {
    runGenerateAll(workspace, domains, null, options.only ?? null, runOptions);
    return;
  }

  const selectedDomains = await selectDomains(domains);
  if (!selectedDomains.length) {
    console.log("生成対象が選択されなかったため、一括生成をキャンセルしました。");
    return;
  }

  console.log(`合計 ${selectedDomains.length} 件のドメインに対してファイル生成を実行します。`);
  console.log("生成対象ドメイン:");
  selectedDomains.forEach((domain) => console.log(`  - ${domain}`));

  const manualSelection = await confirm("生成するファイル種別を手動で選択しますか？（いいえの場合は各 domain.json の設定を使用）", false);
  let manualGenerate = null;
  if (manualSelection) {
    ({ generateFiles: manualGenerate } = await askGenerateFiles());
  }

  if (!runOptions.dryRun && !(await confirm("選択したドメインの生成を実行しますか？既存ファイルは上書きされます。", false))) {
    console.log("一括生成をキャンセルしました。");
    return;
  }

  runGenerateAll(workspace, selectedDomains, manualGenerate, options.only ?? null, runOptions);
}
