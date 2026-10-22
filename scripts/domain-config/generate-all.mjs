#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import generate from "./generate.mjs";
import askGenerateFiles from "./questions/generate-files.mjs";
import { assertDomainFolderNames } from "./utils/domainFolder.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const featuresDir = path.join(rootDir, "src", "features");
const prompt = inquirer.createPromptModule();

export function findDomainDirectories() {
  const dirents = fs.readdirSync(featuresDir, { withFileTypes: true });
  return dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => fs.existsSync(path.join(featuresDir, name, "domain.json")))
    .sort();
}

/**
 * @param {{ yes?: boolean, only?: string[] | null }} [options] yes = プロンプトを出さず、全ドメインを各 domain.json の generateFiles どおりに生成する
 *   only = 生成カテゴリを絞り込む（--only。generateFiles で false のカテゴリは生成しない）
 */
export default async function generateAllDomains(options = {}) {
  const domains = findDomainDirectories();
  if (domains.length === 0) {
    console.log("domain.json を含むドメインが存在しません。");
    return;
  }

  if (options.yes) {
    await runGenerateAll(domains, null, options.only ?? null);
    return;
  }

  const { selectedDomains } = await prompt({
    type: "checkbox",
    name: "selectedDomains",
    message: "生成対象のドメインを選択してください（スペースで選択／Enterで確定）:",
    choices: domains.map((domain) => ({ name: domain, value: domain })),
    default: domains,
    loop: false,
  });

  if (!selectedDomains.length) {
    console.log("生成対象が選択されなかったため、一括生成をキャンセルしました。");
    return;
  }

  console.log(`合計 ${selectedDomains.length} 件のドメインに対してファイル生成を実行します。`);
  console.log("生成対象ドメイン:");
  selectedDomains.forEach((domain) => {
    console.log(`  - ${domain}`);
  });

  const { manualSelection } = await prompt({
    type: "confirm",
    name: "manualSelection",
    message: "生成するファイル種別を手動で選択しますか？（いいえの場合は各 domain.json の設定を使用）",
    default: false,
  });

  let manualGenerate = null;
  if (manualSelection) {
    const selection = await askGenerateFiles();
    manualGenerate = selection.generateFiles;
  }

  const { confirmGenerateAll } = await prompt({
    type: "confirm",
    name: "confirmGenerateAll",
    message: "選択したドメインの生成を実行しますか？既存ファイルは上書きされます。",
    default: false,
  });

  if (!confirmGenerateAll) {
    console.log("一括生成をキャンセルしました。");
    return;
  }

  await runGenerateAll(selectedDomains, manualGenerate, options.only ?? null);
}

async function runGenerateAll(selectedDomains, manualGenerate, only) {
  // 途中のドメインで止まって生成が半端に残らないよう、ループの前に全件を検査する
  assertDomainFolderNames(featuresDir, selectedDomains);
  for (const domain of selectedDomains) {
    console.log(`\n[${domain}] の生成を開始します。`);
    await generate(domain, {
      mode: manualGenerate ? "manual" : "config",
      manualGenerate: manualGenerate ?? undefined,
      interactive: false,
      shouldGenerate: true,
      only,
    });
  }

  console.log("\nすべてのドメインのファイル生成が完了しました。");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await generateAllDomains();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
