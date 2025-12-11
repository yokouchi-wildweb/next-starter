#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toKebabCase,
} from "../../src/utils/stringCase.mjs";

import generateCreateForm from "./generator/components/createForm.mjs";
import generateEditForm from "./generator/components/editForm.mjs";
import generateDomainForm from "./generator/components/domainForm.mjs";
import generateDomainFields from "./generator/components/domainFields.mjs";
import generateDetailModal from "./generator/components/detailModal.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const featuresDir = path.join(rootDir, "src", "features");
const prompt = inquirer.createPromptModule();

// コンポーネント選択肢の定義
const COMPONENT_CHOICES = [
  { name: "CreateXxxForm.tsx（作成フォーム）", value: "createForm" },
  { name: "EditXxxForm.tsx（編集フォーム）", value: "editForm" },
  { name: "XxxForm.tsx（共通フォーム）", value: "domainForm" },
  { name: "XxxFields.tsx（フィールド定義）", value: "domainFields" },
  { name: "XxxDetailModal.tsx（詳細モーダル）", value: "detailModal" },
];

// domain.json を持つディレクトリを検索
function findDomainDirectories() {
  const dirents = fs.readdirSync(featuresDir, { withFileTypes: true });
  return dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => {
      // _template は除外
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
  const kebab = toKebabCase(camel);
  const kebabPlural = toKebabCase(camelPlural);
  const label = domainConfig?.label ?? pascal;

  return {
    tokens: { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label },
    config: domainConfig,
  };
}

// 選択されたコンポーネントを生成
function generateComponents(domain, selectedComponents) {
  const { tokens, config } = buildTokens(domain);

  const generatorMap = {
    createForm: () => generateCreateForm(tokens),
    editForm: () => generateEditForm(tokens),
    domainForm: () => generateDomainForm({ ...tokens, config }),
    domainFields: () => generateDomainFields({ ...tokens, config }),
    detailModal: () => generateDetailModal({ ...tokens, config }),
  };

  selectedComponents.forEach((componentKey) => {
    const generator = generatorMap[componentKey];
    if (generator) {
      generator();
    }
  });
}

export default async function generateComponentsForDomains() {
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

  // 2. コンポーネント選択
  const { selectedComponents } = await prompt({
    type: "checkbox",
    name: "selectedComponents",
    message: "生成するコンポーネントを選択してください（スペースで選択／Enterで確定）:",
    choices: COMPONENT_CHOICES,
    default: ["createForm", "editForm", "domainForm", "domainFields"],
    loop: false,
  });

  if (!selectedComponents.length) {
    console.log("生成対象のコンポーネントが選択されなかったため、キャンセルしました。");
    return;
  }

  // 選択内容の表示
  console.log(`\n対象ドメイン（${selectedDomains.length}件）:`);
  selectedDomains.forEach((domain) => {
    console.log(`  - ${domain}`);
  });

  console.log(`\n生成するコンポーネント（${selectedComponents.length}件）:`);
  selectedComponents.forEach((comp) => {
    const choice = COMPONENT_CHOICES.find((c) => c.value === comp);
    console.log(`  - ${choice?.name || comp}`);
  });

  // 3. 確認
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

  // 4. 生成実行
  for (const domain of selectedDomains) {
    console.log(`\n[${domain}] のコンポーネント生成を開始します。`);
    generateComponents(domain, selectedComponents);
  }

  console.log("\nすべてのコンポーネント生成が完了しました。");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await generateComponentsForDomains();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
