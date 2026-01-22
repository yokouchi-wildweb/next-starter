#!/usr/bin/env node
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "../../src/utils/stringCase.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const featuresDir = path.join(rootDir, "src", "features");
const templateDir = path.join(featuresDir, "_template", "services");
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

// ドメインの tokens を生成
function buildTokens(domainPath) {
  const domainName = domainPath.includes("/") ? domainPath.split("/").pop() : domainPath;
  const camel = toCamelCase(domainName) || domainName;
  const pascal = toPascalCase(domainName) || domainName;
  const snake = toSnakeCase(domainName) || domainName;

  const config = getDomainConfig(domainPath);
  const pluralArg = config?.plural;
  const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
  const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

  return {
    domainPath,
    camel,
    pascal,
    snake,
    camelPlural,
    pascalPlural,
    config,
    dbEngine: config?.dbEngine || "Neon",
  };
}

// belongsToMany リレーション情報を構築
function buildBelongsToManySnippets(config, pascal, camel) {
  if (!Array.isArray(config?.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const relationCamel = toCamelCase(relation.domain);
      const relationTableVar = `${pascal}To${relationPascal}Table`;
      const sourceProperty = `${camel}Id`;
      const targetProperty = `${relationCamel}Id`;
      return {
        tableVar: relationTableVar,
        lines: [
          "{",
          `fieldName: "${relation.fieldName}",`,
          `throughTable: ${relationTableVar},`,
          `sourceColumn: ${relationTableVar}.${sourceProperty},`,
          `targetColumn: ${relationTableVar}.${targetProperty},`,
          `sourceProperty: "${sourceProperty}",`,
          `targetProperty: "${targetProperty}",`,
          "}",
        ],
      };
    });
}

// withRelations 用: belongsTo リレーション設定を生成
function buildBelongsToRelationsSnippets(config) {
  if (!Array.isArray(config?.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsTo")
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const tableImport = `${relationPascal}Table`;
      const field = relation.fieldName.replace(/_id$/, "");
      return {
        tableImport,
        relationDomain: relation.domain,
        literal: [
          "    {",
          `      field: "${field}",`,
          `      foreignKey: "${relation.fieldName}",`,
          `      table: ${tableImport},`,
          "    }",
        ].join("\n"),
      };
    });
}

// withRelations 用: belongsToMany のオブジェクト展開設定を生成
function buildBelongsToManyObjectRelationsSnippets(config, pascal, camel) {
  if (!Array.isArray(config?.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const relationCamel = toCamelCase(relation.domain);
      const targetTableImport = `${relationPascal}Table`;
      const throughTableVar = `${pascal}To${relationPascal}Table`;
      const sourceProperty = `${camel}Id`;
      const targetProperty = `${relationCamel}Id`;
      const field = toPlural(relation.domain.replace(/_/g, "_"));
      return {
        targetTableImport,
        relationDomain: relation.domain,
        literal: [
          "    {",
          `      field: "${field}",`,
          `      targetTable: ${targetTableImport},`,
          `      throughTable: ${throughTableVar},`,
          `      sourceColumn: ${throughTableVar}.${sourceProperty},`,
          `      targetColumn: ${throughTableVar}.${targetProperty},`,
          "    }",
        ].join("\n"),
      };
    });
}

// withCount 用: カウント取得対象のリレーション設定を生成
function buildCountableRelationsSnippets(config, pascal, camel) {
  if (!Array.isArray(config?.relations)) return [];
  if (config.dbEngine !== "Neon") return [];

  return config.relations
    .filter((relation) => relation.relationType === "belongsToMany" && relation.includeRelationTable !== false)
    .map((relation) => {
      const relationPascal = toPascalCase(relation.domain);
      const throughTableVar = `${pascal}To${relationPascal}Table`;
      const sourceProperty = `${camel}Id`;
      const field = toPlural(relation.domain.replace(/_/g, "_"));
      return {
        literal: [
          "    {",
          `      field: "${field}",`,
          `      throughTable: ${throughTableVar},`,
          `      foreignKey: "${sourceProperty}",`,
          "    }",
        ].join("\n"),
      };
    });
}

// belongsToMany リテラルをフォーマット
function formatBelongsToManyLiteral(belongsToMany) {
  if (!belongsToMany.length) return "";
  const literal = belongsToMany
    .map((item) => formatBelongsToManyBlock(item.lines))
    .join(",\n");
  return `  belongsToManyRelations: [\n${literal}\n  ],\n`;
}

function formatBelongsToManyBlock(lines = []) {
  return lines
    .map((line, index) => {
      const isEdge = index === 0 || index === lines.length - 1;
      const indent = isEdge ? "    " : "      ";
      return `${indent}${line}`;
    })
    .join("\n");
}

// すべてのリレーション設定をまとめたリテラルを生成
function formatAllRelationsLiteral(
  belongsToMany,
  belongsToRelations,
  belongsToManyObjectRelations,
  countableRelations
) {
  const sections = [];

  // 既存: belongsToMany の ID配列 hydrate 用
  if (belongsToMany.length) {
    const literal = belongsToMany
      .map((item) => formatBelongsToManyBlock(item.lines))
      .join(",\n");
    sections.push(`  belongsToManyRelations: [\n${literal}\n  ],`);
  }

  // withRelations 用: belongsTo リレーション設定
  if (belongsToRelations.length) {
    const literal = belongsToRelations.map((item) => item.literal).join(",\n");
    sections.push(`  belongsToRelations: [\n${literal}\n  ],`);
  }

  // withRelations 用: belongsToMany のオブジェクト展開設定
  if (belongsToManyObjectRelations.length) {
    const literal = belongsToManyObjectRelations.map((item) => item.literal).join(",\n");
    sections.push(`  belongsToManyObjectRelations: [\n${literal}\n  ],`);
  }

  // withCount 用: カウント取得対象のリレーション設定
  if (countableRelations.length) {
    const literal = countableRelations.map((item) => item.literal).join(",\n");
    sections.push(`  countableRelations: [\n${literal}\n  ],`);
  }

  if (!sections.length) return "";
  return sections.join("\n") + "\n";
}

// リレーション先テーブルのインポート文を生成
function buildRelationTableImports(belongsToRelations, belongsToManyObjectRelations) {
  const relationDomainImports = [
    ...belongsToRelations.map((item) => ({
      domain: item.relationDomain,
      tableImport: item.tableImport,
    })),
    ...belongsToManyObjectRelations.map((item) => ({
      domain: item.relationDomain,
      tableImport: item.targetTableImport,
    })),
  ];

  if (!relationDomainImports.length) return "";

  // ドメインごとにグループ化
  const byDomain = new Map();
  relationDomainImports.forEach(({ domain, tableImport }) => {
    const domainCamel = toCamelCase(domain);
    if (!byDomain.has(domainCamel)) {
      byDomain.set(domainCamel, []);
    }
    const imports = byDomain.get(domainCamel);
    if (!imports.includes(tableImport)) {
      imports.push(tableImport);
    }
  });

  // インポート文を生成
  const lines = [];
  byDomain.forEach((imports, domainCamel) => {
    lines.push(`import { ${imports.join(", ")} } from "@/features/${domainCamel}/entities/drizzle";`);
  });

  return lines.length ? lines.join("\n") + "\n" : "";
}

// Firestore 用のオプションリテラルを構築
function buildFirestoreOptionsLiteral(config) {
  const options = {};
  if (config?.idType) options.idType = config.idType;
  if (config?.useCreatedAt) options.useCreatedAt = true;
  if (config?.useUpdatedAt) options.useUpdatedAt = true;
  if (Array.isArray(config?.searchFields) && config.searchFields.length) {
    options.defaultSearchFields = config.searchFields;
  }
  if (Array.isArray(config?.defaultOrderBy) && config.defaultOrderBy.length) {
    options.defaultOrderBy = config.defaultOrderBy;
  }

  const entries = Object.entries(options).map(([key, value]) => {
    const formatted = JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
    return `  ${key}: ${formatted},`;
  });

  if (!entries.length) return "{}";
  return `{\n${entries.join("\n")}\n}`;
}

// エンティティインポートを構築
function buildEntityImports(pascal, belongsToMany) {
  const imports = [`${pascal}Table`];
  belongsToMany.forEach((item) => {
    if (!imports.includes(item.tableVar)) {
      imports.push(item.tableVar);
    }
  });
  return imports.join(", ");
}

// クライアントサービス生成
function generateClientService(tokens) {
  const { domainPath, camel, pascal } = tokens;
  const templatePath = path.join(templateDir, "client", "__domain__Client.ts");
  const outputDir = path.join(featuresDir, domainPath, "services", "client");
  const outputFile = path.join(outputDir, `${camel}Client.ts`);

  if (!fs.existsSync(templatePath)) {
    console.error(`  テンプレートが見つかりません: ${templatePath}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const content = template
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal);

  fs.writeFileSync(outputFile, content);
  console.log(`  生成: ${outputFile}`);
}

// mediaUploaderフィールドの有無を判定
function hasMediaUploaderField(config) {
  return Array.isArray(config?.fields) && config.fields.some((f) => f.fieldType === "mediaUploader");
}

// サーバーサービス生成
function generateServerService(tokens) {
  const { domainPath, camel, pascal, dbEngine, config } = tokens;
  const hasMediaUploader = hasMediaUploaderField(config);
  const serviceTemplateFile = hasMediaUploader ? "__domain__Service.withStorage.ts" : "__domain__Service.ts";
  const templatePath = path.join(templateDir, "server", serviceTemplateFile);
  const outputDir = path.join(featuresDir, domainPath, "services", "server");
  const outputFile = path.join(outputDir, `${camel}Service.ts`);

  if (!fs.existsSync(templatePath)) {
    console.error(`  テンプレートが見つかりません: ${templatePath}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseFile = dbEngine === "Firestore" ? "firestoreBase" : "drizzleBase";
  const template = fs.readFileSync(templatePath, "utf8");
  const content = template
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__serviceBase__/g, baseFile);

  fs.writeFileSync(outputFile, content);
  console.log(`  生成: ${outputFile}`);

  // wrappers ディレクトリ作成
  const wrapperDir = path.join(outputDir, "wrappers");
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
    const keepFile = path.join(wrapperDir, ".gitkeep");
    fs.writeFileSync(keepFile, "");
  }

  // mediaUploaderがある場合はwrappersも生成
  if (hasMediaUploader) {
    const wrapperTemplates = [
      { src: "wrappers/remove.ts", dest: "wrappers/remove.ts" },
      { src: "wrappers/duplicate.ts", dest: "wrappers/duplicate.ts" },
    ];
    for (const wrapper of wrapperTemplates) {
      const wrapperTemplatePath = path.join(templateDir, "server", wrapper.src);
      const wrapperOutputFile = path.join(outputDir, wrapper.dest);

      if (!fs.existsSync(wrapperTemplatePath)) {
        console.error(`  テンプレートが見つかりません: ${wrapperTemplatePath}`);
        continue;
      }

      const wrapperTemplate = fs.readFileSync(wrapperTemplatePath, "utf8");
      const wrapperContent = wrapperTemplate
        .replace(/__domain__/g, camel)
        .replace(/__Domain__/g, pascal)
        .replace(/__serviceBase__/g, baseFile);

      fs.writeFileSync(wrapperOutputFile, wrapperContent);
      console.log(`  生成: ${wrapperOutputFile}`);
    }

    // .gitkeep があれば削除
    const keepFile = path.join(wrapperDir, ".gitkeep");
    if (fs.existsSync(keepFile)) {
      fs.unlinkSync(keepFile);
    }
  }
}

// ベースサービス生成
function generateBaseService(tokens) {
  const { domainPath, camel, pascal, camelPlural, pascalPlural, config, dbEngine } = tokens;
  const baseFile = dbEngine === "Firestore" ? "firestoreBase.ts" : "drizzleBase.ts";
  const templatePath = path.join(templateDir, "server", baseFile);
  const outputDir = path.join(featuresDir, domainPath, "services", "server");
  const outputFile = path.join(outputDir, baseFile);

  if (!fs.existsSync(templatePath)) {
    console.error(`  テンプレートが見つかりません: ${templatePath}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const template = fs.readFileSync(templatePath, "utf8");
  let content = template
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__domains__/g, camelPlural)
    .replace(/__Domains__/g, pascalPlural);

  if (dbEngine === "Firestore") {
    // Firestore 用のオプション
    const optionsLiteral = buildFirestoreOptionsLiteral(config);
    content = content.replace(/__serviceOptions__/g, optionsLiteral);
  } else {
    // Drizzle 用のリレーション設定
    const belongsToMany = buildBelongsToManySnippets(config, pascal, camel);
    const belongsToRelations = buildBelongsToRelationsSnippets(config);
    const belongsToManyObjectRelations = buildBelongsToManyObjectRelationsSnippets(config, pascal, camel);
    const countableRelations = buildCountableRelationsSnippets(config, pascal, camel);

    const allRelationsLiteral = formatAllRelationsLiteral(
      belongsToMany,
      belongsToRelations,
      belongsToManyObjectRelations,
      countableRelations
    );
    const drizzleEntityImports = buildEntityImports(pascal, belongsToMany);
    const relationTableImportsText = buildRelationTableImports(belongsToRelations, belongsToManyObjectRelations);

    content = content
      .replace(/__DrizzleEntityImports__/g, drizzleEntityImports)
      .replace(/__belongsToManyRelations__/g, allRelationsLiteral)
      .replace(/__RelationTableImports__/g, relationTableImportsText);
  }

  fs.writeFileSync(outputFile, content);
  console.log(`  生成: ${outputFile}`);
}

// ラッパー生成（mediaUploaderフィールドがある場合のみ）
function generateWrapper(tokens, wrapperName) {
  const { domainPath, camel, pascal, dbEngine, config } = tokens;

  // mediaUploaderフィールドがない場合はスキップ
  if (!hasMediaUploaderField(config)) {
    console.log(`  スキップ: ${wrapperName}.ts（mediaUploaderフィールドがありません）`);
    return;
  }

  const templatePath = path.join(templateDir, "server", "wrappers", `${wrapperName}.ts`);
  const outputDir = path.join(featuresDir, domainPath, "services", "server", "wrappers");
  const outputFile = path.join(outputDir, `${wrapperName}.ts`);

  if (!fs.existsSync(templatePath)) {
    console.error(`  テンプレートが見つかりません: ${templatePath}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseFile = dbEngine === "Firestore" ? "firestoreBase" : "drizzleBase";
  const template = fs.readFileSync(templatePath, "utf8");
  const content = template
    .replace(/__domain__/g, camel)
    .replace(/__Domain__/g, pascal)
    .replace(/__serviceBase__/g, baseFile);

  fs.writeFileSync(outputFile, content);
  console.log(`  生成: ${outputFile}`);

  // .gitkeep があれば削除
  const keepFile = path.join(outputDir, ".gitkeep");
  if (fs.existsSync(keepFile)) {
    fs.unlinkSync(keepFile);
  }
}

// 選択されたサービスを生成
function generateServices(domainPath, selectedServices) {
  const tokens = buildTokens(domainPath);

  const generatorMap = {
    clientService: () => generateClientService(tokens),
    serverService: () => generateServerService(tokens),
    baseService: () => generateBaseService(tokens),
    duplicateWrapper: () => generateWrapper(tokens, "duplicate"),
    removeWrapper: () => generateWrapper(tokens, "remove"),
  };

  selectedServices.forEach((serviceKey) => {
    const generator = generatorMap[serviceKey];
    if (generator) {
      generator();
    }
  });
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
