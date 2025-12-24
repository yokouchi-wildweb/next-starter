#!/usr/bin/env node
/**
 * drizzle.ts を更新するジェネレーター
 *
 * 既存の基本カラムは保持し、拡張カラムセクションのみを更新する
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { readSettingFields } from "../utils/config-reader.mjs";
import { mapDrizzleType, camelToSnake, toPascalCase } from "../utils/type-mappers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// マーカーコメント
const EXTENDED_START_MARKER = "  // === 拡張カラム（自動生成）===";
const EXTENDED_END_MARKER = "  // === 拡張カラム終了 ===";

/**
 * drizzle.ts のパスを取得
 */
function getDrizzlePath() {
  const rootDir = path.resolve(__dirname, "..", "..", "..");
  return path.join(rootDir, "src", "features", "core", "setting", "entities", "drizzle.ts");
}

/**
 * Enum 定義を生成
 */
function generateEnumDefinitions(fields) {
  const enumFields = fields.filter((f) => f.fieldType === "enum" && f.options?.length > 0);
  if (enumFields.length === 0) return "";

  const enumDefs = enumFields.map((field) => {
    const enumName = `setting${toPascalCase(field.name)}Enum`;
    const dbEnumName = `setting_${camelToSnake(field.name)}_enum`;
    const values = field.options.map((o) => `"${o.value}"`).join(", ");
    return `export const ${enumName} = pgEnum("${dbEnumName}", [${values}]);`;
  });

  return enumDefs.join("\n") + "\n\n";
}

/**
 * カラム定義を生成
 */
function generateColumnDefinitions(fields) {
  return fields.map((field) => {
    const { columnDef } = mapDrizzleType(field);
    return `  ${field.name}: ${columnDef},`;
  }).join("\n");
}

/**
 * 必要なインポートを収集
 */
function collectImports(fields) {
  const imports = new Set(["pgTable", "text", "integer", "timestamp"]);

  for (const field of fields) {
    const { imports: fieldImports } = mapDrizzleType(field);
    fieldImports.forEach((imp) => imports.add(imp));
  }

  return Array.from(imports);
}

/**
 * drizzle.ts を更新
 */
export default function updateDrizzle() {
  const config = readSettingFields();
  const drizzlePath = getDrizzlePath();

  if (!fs.existsSync(drizzlePath)) {
    console.error(`drizzle.ts が見つかりません: ${drizzlePath}`);
    return false;
  }

  let content = fs.readFileSync(drizzlePath, "utf-8");

  // 拡張フィールドがない場合
  if (!config || !config.fields || config.fields.length === 0) {
    // 既存の拡張セクションがあれば削除
    if (content.includes(EXTENDED_START_MARKER)) {
      const startIndex = content.indexOf(EXTENDED_START_MARKER);
      const endIndex = content.indexOf(EXTENDED_END_MARKER);
      if (endIndex !== -1) {
        content = content.slice(0, startIndex) + content.slice(endIndex + EXTENDED_END_MARKER.length + 1);
      }
      fs.writeFileSync(drizzlePath, content, "utf-8");
      console.log(`拡張カラムを削除しました: ${drizzlePath}`);
    } else {
      console.log("拡張フィールドがないため、drizzle.ts の更新をスキップします");
    }
    return false;
  }

  const fields = config.fields;

  // Enum定義を生成
  const enumDefinitions = generateEnumDefinitions(fields);

  // カラム定義を生成
  const columnDefinitions = generateColumnDefinitions(fields);

  // 拡張セクションの内容
  const extendedSection = `${EXTENDED_START_MARKER}
${columnDefinitions}
${EXTENDED_END_MARKER}`;

  // インポートを更新
  const requiredImports = collectImports(fields);
  const hasEnum = fields.some((f) => f.fieldType === "enum" && f.options?.length > 0);

  // インポート行を更新
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']drizzle-orm\/pg-core["'];/;
  const importMatch = content.match(importRegex);

  if (importMatch) {
    const currentImports = importMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    const allImports = new Set([...currentImports, ...requiredImports]);
    const newImportLine = `import { ${Array.from(allImports).join(", ")} } from "drizzle-orm/pg-core";`;
    content = content.replace(importRegex, newImportLine);
  }

  // 既存の拡張セクションがあれば置換、なければ追加
  if (content.includes(EXTENDED_START_MARKER)) {
    // 既存セクションを置換
    const startIndex = content.indexOf(EXTENDED_START_MARKER);
    const endIndex = content.indexOf(EXTENDED_END_MARKER) + EXTENDED_END_MARKER.length;
    content = content.slice(0, startIndex) + extendedSection + content.slice(endIndex);
  } else {
    // テーブル定義の閉じ括弧の前に追加
    const tableEndPattern = /(\s*createdAt:[^,]+,\s*\n\s*updatedAt:[^,]+,?\s*\n)(\s*\}\);)/;
    const match = content.match(tableEndPattern);

    if (match) {
      content = content.replace(
        tableEndPattern,
        `$1\n${extendedSection}\n$2`
      );
    } else {
      // フォールバック: 最後の });　の前に追加
      const lastBraceIndex = content.lastIndexOf("});");
      if (lastBraceIndex !== -1) {
        content = content.slice(0, lastBraceIndex) + "\n" + extendedSection + "\n" + content.slice(lastBraceIndex);
      }
    }
  }

  // Enum定義を追加（テーブル定義の前）
  if (hasEnum) {
    // 既存のEnum定義を削除
    content = content.replace(/export const setting\w+Enum = pgEnum\([^)]+\);\n*/g, "");

    // テーブル定義の前にEnum定義を追加
    const tableDefIndex = content.indexOf("export const settingTable");
    if (tableDefIndex !== -1) {
      content = content.slice(0, tableDefIndex) + enumDefinitions + content.slice(tableDefIndex);
    }
  }

  fs.writeFileSync(drizzlePath, content, "utf-8");
  console.log(`更新完了: ${drizzlePath}`);
  return true;
}

// 直接実行時の処理
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateDrizzle();
}
