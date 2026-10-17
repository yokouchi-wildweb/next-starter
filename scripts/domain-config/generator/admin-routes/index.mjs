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
//
// 出力の構造(SCREENS: src/lib/screens/README.md §12):
//   src/app/admin/(protected)/<domains>/page.tsx            1 行スイッチ。初回のみ生成(write-once)、以後上書きしない
//   src/app/admin/(protected)/<domains>/_screen/<Name>.tsx  既定画面。毎回再生成(手で編集しない)
//   同 new/ [id]/edit/ sort/(sortOrderField があるとき)
// 既存の page.tsx が旧形式(本体を直接持つ)なら一度だけ 1 行スイッチへ書き換える(移行)。
// _components/ には触らない(fork 所有)。

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

const camel = toCamelCase(domain) || domain;
const pascal = toPascalCase(domain) || domain;


const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const templateDir = path.join(process.cwd(), "src", "app", "admin", "_template");
const protectedDirName = "(protected)";

// ルートごとに page.tsx(write-once)と _screen/(毎回再生成)のテンプレート対
const routes = [
  {
    page: path.join("__domains__", "page.tsx"),
    screen: path.join("__domains__", "_screen", "Admin__Domain__ListScreen.tsx"),
  },
  {
    page: path.join("__domains__", "new", "page.tsx"),
    screen: path.join("__domains__", "new", "_screen", "Admin__Domain__CreateScreen.tsx"),
  },
  {
    page: path.join("__domains__", "[id]", "edit", "page.tsx"),
    screen: path.join("__domains__", "[id]", "edit", "_screen", "Admin__Domain__EditScreen.tsx"),
  },
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

// sortOrderField が設定されているドメインには並び替えページを追加
if (domainConfig?.sortOrderField) {
  routes.push({
    page: path.join("__domains__", "sort", "page.tsx"),
    screen: path.join("__domains__", "sort", "_screen", "Admin__Domain__SortScreen.tsx"),
  });
}

let dbEngine = domainConfig?.dbEngine || "";
// CLI 引数があれば設定より優先
if (dbEngineArg) dbEngine = dbEngineArg;


const kebab = toKebabCase(camel);
const kebabPlural = toKebabCase(camelPlural);

const label = domainConfig?.label ?? pascal;

const tokens = { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label };


const relTokens = buildRelationTokens(domainConfig?.relations, tokens);

// テンプレートの相対パスを出力先の相対パスへ(ディレクトリは kebab 複数形、ファイル名は PascalCase)
function toOutputRelativePath(templateRelative) {
  return templateRelative
    .replace("__domains__", kebabPlural)
    .replace(/__Domain__/g, pascal);
}

function readTemplate(templateRelative) {
  const templatePath = path.join(templateDir, templateRelative);
  // テンプレートが存在しなければエラー
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }
  return fs.readFileSync(templatePath, "utf8");
}

function render(templateRelative) {
  const content = replaceTokens(readTemplate(templateRelative), tokens);
  return content
    .replace(/__RELATION_IMPORTS__/g, relTokens.imports)
    .replace(/__ASYNC__/g, relTokens.async)
    .replace(/__RELATION_FETCH__/g, relTokens.relationFetchNew)
    .replace(/__EDIT_FETCH__/g, relTokens.editFetch)
    .replace(/__SWR_START__/g, relTokens.swrStart)
    .replace(/__SWR_END__/g, relTokens.swrEnd)
    .replace(/__SORT_ORDER_FIELD__/g, domainConfig?.sortOrderField ?? "sort_order");
}

function outputPath(templateRelative) {
  return path.join(process.cwd(), "src", "app", "admin", protectedDirName, toOutputRelativePath(templateRelative));
}

function writeFile(file, content) {
  const dir = path.dirname(file);
  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, content);
}

/**
 * 既存の page.tsx が旧形式(本体を直接持つ)か。
 * コメントを除いた本文が `export default` を含み、./_screen/ も ./_components/ も参照していなければ
 * 旧形式とみなし、一度だけ 1 行スイッチへ移行する。
 * fork が _components/ へ向けた page.tsx(`export { X as default } from "./_components/X"` や
 * `import X from "./_components/X"; export default X;`)は保持される。
 */
function isLegacyPage(content) {
  const body = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return /export\s+default\b/.test(body) && !/from\s+["']\.\/(_screen|_components)\//.test(body);
}

for (const route of routes) {
  // _screen/: 毎回再生成
  const screenFile = outputPath(route.screen);
  writeFile(screenFile, render(route.screen));
  console.log(`管理画面(_screen)を生成しました: ${screenFile}`);

  // page.tsx: write-once。旧形式なら一度だけ移行
  const pageFile = outputPath(route.page);
  if (!fs.existsSync(pageFile)) {
    writeFile(pageFile, render(route.page));
    console.log(`管理画面ルートを生成しました: ${pageFile}`);
  } else if (isLegacyPage(fs.readFileSync(pageFile, "utf8"))) {
    writeFile(pageFile, render(route.page));
    console.log(`旧形式の page.tsx を 1 行スイッチへ移行しました(以後は上書きしません): ${pageFile}`);
  } else {
    console.log(`page.tsx は既存のため保持しました(write-once): ${pageFile}`);
  }
}
