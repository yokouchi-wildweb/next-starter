#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  replaceTokens,
  buildRelationTokens,
} from './helpers.mjs';

//
// Admin route generator
//
// Usage:
//   node scripts/domain-config/generator/admin-routes/index.mjs <Domain>
//   node scripts/domain-config/generator/admin-routes/index.mjs <Domain> --plural <plural>
//
// <Domain> should be the domain name in camelCase or PascalCase.
// --plural can be used when the plural form is irregular (e.g. person -> people).

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
// --plural オプションが指定されていればその値を取得
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

let dbEngineArg;
const dbIndex = args.findIndex((a) => a === "--dbEngine" || a === "-d");
// --dbEngine オプションが指定されていればその値を取得
if (dbIndex !== -1) {
  dbEngineArg = args[dbIndex + 1];
}

// ドメイン名が無ければ使い方を表示して終了
if (!domain) {
  console.error(
    '使い方: node scripts/domain-config/generator/admin-routes/index.mjs <Domain> [--plural <plural>]'
  );
  process.exit(1);
}

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
const pascal = domain.charAt(0).toUpperCase() + domain.slice(1);


const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const templateDir = path.join(process.cwd(), "src", "app", "admin", "_template");
const protectedDirName = "(protected)";

const templates = [
  path.join("__domains__", "page.tsx"),
  path.join("__domains__", "new", "page.tsx"),
  path.join("__domains__", "[id]", "edit", "page.tsx"),
];

const configPath = path.join(
  process.cwd(),
  "src",
  "features",
  camel,
  "domain.json",
);
let domainConfig = null;
if (fs.existsSync(configPath)) {
  domainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

let dbEngine = domainConfig?.dbEngine || "";
// CLI 引数があれば設定より優先
if (dbEngineArg) dbEngine = dbEngineArg;


const kebab = toKebabCase(camel);
const kebabPlural = toKebabCase(camelPlural);

const label = domainConfig?.label ?? pascal;

const tokens = { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label };


const relTokens = buildRelationTokens(domainConfig?.relations, tokens);

const sqlImport = "";
const searchCall = "search({ page, limit, searchQuery })";

for (const file of templates) {
  const templatePath = path.join(templateDir, file);
  const outputFile = path.join(
    process.cwd(),
    "src",
    "app",
    "admin",
    protectedDirName,
    file.replace("__domains__", kebabPlural)
  );
  const outputFileDir = path.dirname(outputFile);

  // テンプレートが存在しなければエラー
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputFileDir)) {
    fs.mkdirSync(outputFileDir, { recursive: true });
  }

  let template = fs.readFileSync(templatePath, "utf8");
  let content = replaceTokens(template, tokens);

  content = content
    .replace(/__RELATION_IMPORTS__/g, relTokens.imports)
    .replace(/__ASYNC__/g, relTokens.async)
    .replace(/__LIST_FETCH__/g, relTokens.listFetchNew)
    .replace(/__DOMAIN_AND_LIST_FETCH__/g, relTokens.listFetchEdit)
    .replace(/__SWR_START__/g, relTokens.swrStart)
    .replace(/__SWR_END__/g, relTokens.swrEnd)
    .replace(/__SQL_IMPORT__/g, sqlImport)
    .replace(/__SEARCH_CALL__/g, searchCall);

  fs.writeFileSync(outputFile, content);
  console.log(`管理画面ルートを生成しました: ${outputFile}`);
}

