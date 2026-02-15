#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
} from "../../src/utils/stringCase.mjs";

import generateGet from "./generator/hooks/get.mjs";
import generateList from "./generator/hooks/list.mjs";
import generateSearch from "./generator/hooks/search.mjs";
import generateCreate from "./generator/hooks/create.mjs";
import generateUpdate from "./generator/hooks/update.mjs";
import generateUpsert from "./generator/hooks/upsert.mjs";
import generateDelete from "./generator/hooks/delete.mjs";
import generateBulkDeleteByIds from "./generator/hooks/bulkDeleteByIds.mjs";
import generateBulkDeleteByQuery from "./generator/hooks/bulkDeleteByQuery.mjs";
import generateBulkUpsert from "./generator/hooks/bulkUpsert.mjs";
import generateBulkUpdate from "./generator/hooks/bulkUpdate.mjs";
import generateViewModal from "./generator/hooks/viewModal.mjs";
import generateDuplicate from "./generator/hooks/duplicate.mjs";
import generateRestore from "./generator/hooks/restore.mjs";
import generateHardDelete from "./generator/hooks/hardDelete.mjs";
import generateReorder from "./generator/hooks/reorder.mjs";
import generateSearchForSorting from "./generator/hooks/searchForSorting.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const featuresDir = path.join(rootDir, "src", "features");
const prompt = inquirer.createPromptModule();

// 基本フック選択肢
const BASE_HOOK_CHOICES = [
  { name: "useXxx.ts（単一取得）", value: "get" },
  { name: "useXxxList.ts（一覧取得）", value: "list" },
  { name: "useSearchXxx.ts（検索）", value: "search" },
  { name: "useCreateXxx.ts（作成）", value: "create" },
  { name: "useUpdateXxx.ts（更新）", value: "update" },
  { name: "useUpsertXxx.ts（upsert）", value: "upsert" },
  { name: "useDeleteXxx.ts（削除）", value: "delete" },
  { name: "useBulkDeleteByIdsXxx.ts（ID指定一括削除）", value: "bulkDeleteByIds" },
  { name: "useBulkDeleteByQueryXxx.ts（クエリ指定一括削除）", value: "bulkDeleteByQuery" },
  { name: "useBulkUpsertXxx.ts（一括upsert）", value: "bulkUpsert" },
  { name: "useBulkUpdateXxx.ts（一括更新）", value: "bulkUpdate" },
];

// 条件付きフック選択肢
const CONDITIONAL_HOOK_CHOICES = [
  { name: "useXxxViewModal.ts（詳細モーダル）", value: "viewModal", condition: "useDetailModal" },
  { name: "useDuplicateXxx.ts（複製）", value: "duplicate", condition: "useDuplicateButton" },
  { name: "useRestoreXxx.ts（復元）", value: "restore", condition: "useSoftDelete" },
  { name: "useHardDeleteXxx.ts（物理削除）", value: "hardDelete", condition: "useSoftDelete" },
  { name: "useReorderXxx.ts（並び替え）", value: "reorder", condition: "sortOrderField" },
  { name: "useSearchForSortingXxx.ts（ソート用検索）", value: "searchForSorting", condition: "sortOrderField" },
];

// フック種別からジェネレータ関数へのマッピング
const generatorMap = {
  get: (tokens) => generateGet(tokens),
  list: (tokens) => generateList(tokens),
  search: (tokens) => generateSearch(tokens),
  create: (tokens) => generateCreate(tokens),
  update: (tokens) => generateUpdate(tokens),
  upsert: (tokens) => generateUpsert(tokens),
  delete: (tokens) => generateDelete(tokens),
  bulkDeleteByIds: (tokens) => generateBulkDeleteByIds(tokens),
  bulkDeleteByQuery: (tokens) => generateBulkDeleteByQuery(tokens),
  bulkUpsert: (tokens) => generateBulkUpsert(tokens),
  bulkUpdate: (tokens) => generateBulkUpdate(tokens),
  viewModal: (tokens) => generateViewModal(tokens),
  duplicate: (tokens) => generateDuplicate(tokens),
  restore: (tokens) => generateRestore(tokens),
  hardDelete: (tokens) => generateHardDelete(tokens),
  reorder: (tokens) => generateReorder(tokens),
  searchForSorting: (tokens) => generateSearchForSorting(tokens),
};

// domain.json を持つディレクトリを検索
function findDomainDirectories() {
  const dirents = fs.readdirSync(featuresDir, { withFileTypes: true });
  return dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => {
      if (name === "_template") return false;
      return fs.existsSync(path.join(featuresDir, name, "domain.json"));
    })
    .sort();
}

// ドメインの tokens を生成
function buildTokens(domain) {
  const camel = toCamelCase(domain) || domain;
  const pascal = toPascalCase(domain) || domain;

  const configPath = path.join(featuresDir, camel, "domain.json");
  let domainConfig = null;
  if (fs.existsSync(configPath)) {
    domainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  const pluralArg = domainConfig?.plural;
  const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
  const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

  return {
    tokens: { camel, pascal, camelPlural, pascalPlural, config: domainConfig },
    config: domainConfig,
  };
}

// ドメイン設定に基づいて利用可能なフック選択肢を構築
function buildHookChoices(domainConfigs) {
  // 条件付きフックは、選択されたドメインのうち少なくとも1つが条件を満たす場合に表示
  const conditionalChoices = CONDITIONAL_HOOK_CHOICES.filter((choice) =>
    domainConfigs.some((config) => config && config[choice.condition])
  );

  return [...BASE_HOOK_CHOICES, ...conditionalChoices];
}

// 選択されたフックを生成
function generateHooks(domain, selectedHooks) {
  const { tokens, config } = buildTokens(domain);

  // 条件付きフックがドメイン設定と合わない場合はスキップ
  selectedHooks.forEach((hookKey) => {
    const conditionalDef = CONDITIONAL_HOOK_CHOICES.find((c) => c.value === hookKey);
    if (conditionalDef && !config?.[conditionalDef.condition]) {
      console.log(`  [スキップ] ${hookKey}: ${domain} では ${conditionalDef.condition} が無効です`);
      return;
    }

    const generator = generatorMap[hookKey];
    if (generator) {
      generator(tokens);
    }
  });
}

export default async function generateHooksForDomains() {
  const domains = findDomainDirectories();
  if (domains.length === 0) {
    console.log("domain.json を含むドメインが存在しません。");
    return;
  }

  // 1. ドメイン選択
  const { selectedDomains } = await prompt({
    type: "checkbox",
    name: "selectedDomains",
    message: "生成対象のドメインを選択してください（スペースで選択／Enterで確定）:",
    choices: domains.map((domain) => ({ name: domain, value: domain })),
    default: domains,
    loop: false,
  });

  if (!selectedDomains.length) {
    console.log("生成対象が選択されなかったため、キャンセルしました。");
    return;
  }

  // 2. 選択されたドメインの設定を取得
  const domainConfigs = selectedDomains.map((domain) => {
    const { config } = buildTokens(domain);
    return config;
  });

  // 3. フック選択（ドメイン設定に応じた選択肢を表示）
  const hookChoices = buildHookChoices(domainConfigs);

  const { selectedHooks } = await prompt({
    type: "checkbox",
    name: "selectedHooks",
    message: "生成するフックを選択してください（スペースで選択／Enterで確定）:",
    choices: hookChoices,
    default: BASE_HOOK_CHOICES.map((c) => c.value),
    loop: false,
  });

  if (!selectedHooks.length) {
    console.log("生成対象のフックが選択されなかったため、キャンセルしました。");
    return;
  }

  // 選択内容の表示
  console.log(`\n対象ドメイン（${selectedDomains.length}件）:`);
  selectedDomains.forEach((domain) => {
    console.log(`  - ${domain}`);
  });

  console.log(`\n生成するフック（${selectedHooks.length}件）:`);
  selectedHooks.forEach((hook) => {
    const choice = hookChoices.find((c) => c.value === hook);
    console.log(`  - ${choice?.name || hook}`);
  });

  // 4. 確認
  const { confirmGenerate } = await prompt({
    type: "confirm",
    name: "confirmGenerate",
    message: "\n選択した内容で生成を実行しますか？既存ファイルは上書きされます。",
    default: false,
  });

  if (!confirmGenerate) {
    console.log("生成をキャンセルしました。");
    return;
  }

  // 5. 生成実行
  for (const domain of selectedDomains) {
    console.log(`\n[${domain}] のフック生成を開始します。`);
    generateHooks(domain, selectedHooks);
  }

  console.log("\nすべてのフック生成が完了しました。");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await generateHooksForDomains();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
