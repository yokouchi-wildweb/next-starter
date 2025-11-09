#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
} from "../../../src/utils/stringCase.mjs";

//
// サーバーサービス生成スクリプト
//
// 使い方:
//   node scripts/domain-generator/generate-server-service.mjs <Domain>
//
// <Domain> にはキャメルケースまたはパスカルケースでドメイン名を指定します。
// base.ts と <domain>Service.ts を src/features/<domain>/services/server/
// に作成します。

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
// --plural オプションがあればその値を取得
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

let dbEngineArg;
const dbIndex = args.findIndex((a) => a === "--dbEngine" || a === "-d");
// --dbEngine オプションがあれば使用するデータベース種別を取得
if (dbIndex !== -1) {
  dbEngineArg = args[dbIndex + 1];
}

// ドメイン名が指定されていない場合は使い方を表示して終了
if (!domain) {
  console.error("使い方: node scripts/domain-generator/generate-server-service.mjs <Domain>");
  process.exit(1);
}

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
const pascal = domain.charAt(0).toUpperCase() + domain.slice(1);


const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const baseTemplateDir = path.join(process.cwd(), "src", "features", "_template", "services", "server");

const camelDir = path.join(process.cwd(), "src", "features", camel);
const configPath = path.join(camelDir, "domain.json");
let dbEngine = "";
let serviceOptions = {};
if (fs.existsSync(configPath)) {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  dbEngine = cfg.dbEngine || "";
  if (cfg.idType) serviceOptions.idType = cfg.idType;
  if (cfg.useCreatedAt) serviceOptions.useCreatedAt = true;
  if (cfg.useUpdatedAt) serviceOptions.useUpdatedAt = true;
  if (Array.isArray(cfg.searchFields) && cfg.searchFields.length)
    serviceOptions.defaultSearchFields = cfg.searchFields;
  if (Array.isArray(cfg.defaultOrderBy) && cfg.defaultOrderBy.length)
    serviceOptions.defaultOrderBy = cfg.defaultOrderBy;
}
// コマンドラインで指定された場合は設定より優先
if (dbEngineArg) dbEngine = dbEngineArg;

const templateDir = baseTemplateDir;
const outputDir = path.join(
  process.cwd(),
  "src",
  "features",
  camel,
  "services",
  "server"
);
const wrapperDir = path.join(outputDir, "wrappers");

const baseFile = dbEngine === "Firestore" ? "firestoreBase.ts" : "drizzleBase.ts";
const templates = [baseFile, "__domain__Service.ts"];

// オプションオブジェクトを TypeScript のオブジェクト記法に変換
function optionsToString(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"\n]+)":/g, "$1:");
}

const optionsString = optionsToString(serviceOptions);

// テンプレート文字列内のトークンを置換
function replaceTokens(content) {
  return content
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural)
    .replace(/__serviceBase__/g, baseFile.replace(/\.ts$/, ""))
    .replace(/__serviceOptions__/g, optionsString);
}

for (const file of templates) {
  const templatePath = path.join(templateDir, file);
  const outputFileName = replaceTokens(file);
  const outputFile = path.join(outputDir, outputFileName);

  // テンプレートファイルが無い場合はエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // wrappers ディレクトリが無ければ作成し .gitkeep を追加
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    const keepFile = path.join(wrapperDir, ".gitkeep");
    fs.writeFileSync(keepFile, "");
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const content = replaceTokens(template);

  fs.writeFileSync(outputFile, content);
  console.log(`サーバーサービスを生成しました: ${outputFile}`);
}
