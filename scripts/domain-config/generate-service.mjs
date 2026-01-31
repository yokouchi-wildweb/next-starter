#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import { toCamelCase } from "../../src/utils/stringCase.mjs";

// generator/ からインポート
import generateClientService from "./generator/generate-client-service.mjs";
import generateServerService from "./generator/generate-server-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const featuresDir = path.join(rootDir, "src", "features");
const prompt = inquirer.createPromptModule();

// サービス選択肢の定義
const SERVICE_CHOICES = [
  { name: "xxxClient.ts（クライアントサービス）", value: "clientService" },
  { name: "xxxService.ts（サーバーサービス）", value: "serverService" },
  { name: "drizzleBase.ts / firestoreBase.ts（ベースサービス）", value: "baseService" },
  { name: "wrappers/duplicate.ts（複製ラッパー）", value: "duplicateWrapper" },
  { name: "wrappers/remove.ts（削除ラッパー）", value: "removeWrapper" },
];

// domain.json を持つディレクトリを検索（core配下は除外）
function findDomainDirectories() {
  const dirents = fs.readdirSync(featuresDir, { withFileTypes: true });
  const domains = [];

  // トップレベルのドメインのみ（_template と core は除外）
  dirents
    .filter((dirent) => dirent.isDirectory())
    .forEach((dirent) => {
      const name = dirent.name;
      if (name === "_template" || name === "core") return;
      if (fs.existsSync(path.join(featuresDir, name, "domain.json"))) {
        domains.push(name);
      }
    });

  return domains.sort();
}

// ドメインの設定を取得
function getDomainConfig(domainPath) {
  const configPath = path.join(featuresDir, domainPath, "domain.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  return null;
}

// 選択されたサービスを生成
function generateServices(domainPath, selectedServices) {
  const camel = toCamelCase(domainPath) || domainPath;
  const config = getDomainConfig(domainPath);
  const plural = config?.plural;
  const dbEngine = config?.dbEngine;

  // クライアントサービス
  if (selectedServices.includes("clientService")) {
    generateClientService(camel);
  }

  // サーバー関連（baseService, serverService, wrappers）
  const serverTargets = {
    base: selectedServices.includes("baseService"),
    service: selectedServices.includes("serverService"),
    duplicateWrapper: selectedServices.includes("duplicateWrapper"),
    removeWrapper: selectedServices.includes("removeWrapper"),
  };

  // サーバー関連のいずれかが選択されている場合のみ実行
  if (serverTargets.base || serverTargets.service || serverTargets.duplicateWrapper || serverTargets.removeWrapper) {
    generateServerService(camel, { plural, dbEngine, targets: serverTargets });
  }
}

export default async function generateServicesForDomains() {
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

  // 2. サービス選択
  const { selectedServices } = await prompt({
    type: "checkbox",
    name: "selectedServices",
    message: "生成するサービスを選択してください（スペースで選択／Enterで確定）:",
    choices: SERVICE_CHOICES,
    default: ["clientService", "serverService", "baseService"],
    loop: false,
  });

  if (!selectedServices.length) {
    console.log("生成対象のサービスが選択されなかったため、キャンセルしました。");
    return;
  }

  // 選択内容の表示
  console.log(`\n対象ドメイン（${selectedDomains.length}件）:`);
  selectedDomains.forEach((domain) => {
    const config = getDomainConfig(domain);
    const dbEngine = config?.dbEngine || "Neon";
    console.log(`  - ${domain} (${dbEngine})`);
  });

  console.log(`\n生成するサービス（${selectedServices.length}件）:`);
  selectedServices.forEach((service) => {
    const choice = SERVICE_CHOICES.find((c) => c.value === service);
    console.log(`  - ${choice?.name || service}`);
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
    console.log(`\n[${domain}] のサービス生成を開始します。`);
    generateServices(domain, selectedServices);
  }

  console.log("\nすべてのサービス生成が完了しました。");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await generateServicesForDomains();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
