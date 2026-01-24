#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "../../../src/utils/stringCase.mjs";

//
// Hooks generator
//
// 使い方:
//   node scripts/domain-generator/generate-hooks.mjs <Domain>
//   node scripts/domain-generator/generate-hooks.mjs <Domain> --plural <複数形>
//
// <Domain> にはキャメルケースまたはパスカルケースでドメイン名を指定します。
// --plural で複雑な変化をする複数形を指定できます（例: person -> people）。

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
// --plural オプションが指定されていれば複数形を取得
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

// ドメイン名が無い場合は使い方を表示して終了
if (!domain) {
  console.error(
    "使い方: node scripts/domain-generator/generate-hooks.mjs <Domain> [--plural <plural>]"
  );
  process.exit(1);
}

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;


const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const configPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
let domainConfig = null;
if (fs.existsSync(configPath)) {
  domainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const relations = Array.isArray(domainConfig?.relations) ? domainConfig.relations : [];

const templateDir = path.join(process.cwd(), "src", "features", "_template", "hooks");
const outputDir = path.join(process.cwd(), "src", "features", camel, "hooks");

const templates = [
  "use__Domain__.ts",
  "use__Domain__List.ts",
  "useSearch__Domain__.ts",
  "useCreate__Domain__.ts",
  "useUpdate__Domain__.ts",
  "useUpsert__Domain__.ts",
  "useDelete__Domain__.ts",
  "useBulkDeleteByIds__Domain__.ts",
  "useBulkDeleteByQuery__Domain__.ts",
  "useBulkUpsert__Domain__.ts",
];

if (domainConfig?.useDetailModal) {
  templates.push("use__Domain__ViewModal.ts");
}

if (domainConfig?.useDuplicateButton) {
  templates.push("useDuplicate__Domain__.ts");
}

if (domainConfig?.useSoftDelete) {
  templates.push("useRestore__Domain__.ts");
  templates.push("useHardDelete__Domain__.ts");
}

if (domainConfig?.sortOrderField) {
  templates.push("useReorder__Domain__.ts");
  templates.push("useSearchForSorting__Domain__.ts");
}

// テンプレート文字列のトークンをドメイン名で置換
function replaceTokens(content) {
  return content
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural);
}

for (const file of templates) {
  const templatePath = path.join(templateDir, file);
  const outputFileName = replaceTokens(file);
  const outputFile = path.join(outputDir, outputFileName);


  // テンプレートが存在しなければエラー終了
  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  // 出力先ディレクトリが無ければ作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const template = fs.readFileSync(templatePath, "utf8");
  let content = replaceTokens(template);

  if (file === "use__Domain__ViewModal.ts") {
    const relationDetails = relations.map((relation) => {
      const relationNormalized = toSnakeCase(relation.domain) || relation.domain;
      const relationCamel = toCamelCase(relationNormalized) || relationNormalized;
      const relationPascal = toPascalCase(relationNormalized) || relationNormalized;
      const relationCamelPlural = toPlural(relationCamel);
      const hookName = `use${relationPascal}List`;
      const importPath = `@/features/${relationCamel}/hooks/${hookName}`;

      return {
        hookName,
        importPath,
        camelPlural: relationCamelPlural,
      };
    });

    const relationImports = relationDetails
      .map(({ hookName, importPath }) => `import { ${hookName} } from "${importPath}";`)
      .join("\n");

    const relationHooks = relationDetails
      .map(({ hookName, camelPlural }) => `  const { data: ${camelPlural} = [] } = ${hookName}();`)
      .join("\n");

    const relationDependencies = relationDetails
      .map(({ camelPlural }) => `    ${camelPlural},`)
      .join("\n");

    const relationSummaryBlock = relationDetails.length
      ? `    const relationSummary = Object.entries({\n${relationDetails
          .map(({ camelPlural }) => `      ${camelPlural},`)
          .join("\n")}\n    })\n      .map(([key, items]) => \`${'${'}key${'}'}: ${'${'}Array.isArray(items) ? items.length : 0${'}'}件\`)\n      .join(" / ");\n\n`
      : "";

    content = content
      .replace(/__RELATION_IMPORTS__/g, relationImports ? `${relationImports}\n` : "")
      .replace(/__RELATION_HOOKS__/g, relationHooks ? `${relationHooks}\n` : "")
      .replace(/__RELATION_SUMMARY_BLOCK__/g, relationSummaryBlock)
      .replace(/__RELATION_DEPENDENCIES__/g, relationDependencies);
  }

  fs.writeFileSync(outputFile, content);
  console.log(`フックを生成しました: ${outputFile}`);
}
