import fs from "fs";
import path from "path";
import { toPlural, toCamelCase, toPascalCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { templateDir, replaceTokens } from "./utils/template.mjs";
import { ensureDirExists } from "../utils/pathHelpers.mjs";

// use__Domain__ViewModal.ts（詳細モーダルフック）を生成する
// リレーション情報を注入する特殊処理を含む
export default function generate(tokens) {
  const { camel, config } = tokens;
  const templateFileName = "use__Domain__ViewModal.ts";
  const templatePath = path.join(templateDir, templateFileName);
  const outputFileName = replaceTokens(templateFileName, tokens);
  const outputDir = path.join(process.cwd(), "src", "features", camel, "hooks");
  const outputFile = path.join(outputDir, outputFileName);

  if (!fs.existsSync(templatePath)) {
    console.error(`テンプレートが見つかりません: ${templatePath}`);
    process.exit(1);
  }

  ensureDirExists(outputDir);

  const template = fs.readFileSync(templatePath, "utf8");
  let content = replaceTokens(template, tokens);

  // リレーション情報の注入
  const relations = Array.isArray(config?.relations) ? config.relations : [];
  const relationDetails = relations.map((relation) => {
    const relationNormalized = toSnakeCase(relation.domain) || relation.domain;
    const relationCamel = toCamelCase(relationNormalized) || relationNormalized;
    const relationPascal = toPascalCase(relationNormalized) || relationNormalized;
    const relationCamelPlural = toPlural(relationCamel);
    const hookName = `use${relationPascal}List`;
    const importPath = `@/features/${relationCamel}/hooks/${hookName}`;

    return { hookName, importPath, camelPlural: relationCamelPlural };
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
        .join("\n")}\n    })\n      .map(([key, items]) => \`${"${"}key${"}"}: ${"${"}Array.isArray(items) ? items.length : 0${"}"}件\`)\n      .join(" / ");\n\n`
    : "";

  content = content
    .replace(/__RELATION_IMPORTS__/g, relationImports ? `${relationImports}\n` : "")
    .replace(/__RELATION_HOOKS__/g, relationHooks ? `${relationHooks}\n` : "")
    .replace(/__RELATION_SUMMARY_BLOCK__/g, relationSummaryBlock)
    .replace(/__RELATION_DEPENDENCIES__/g, relationDependencies);

  fs.writeFileSync(outputFile, content);
  console.log(`フックを生成しました: ${outputFile}`);
}
