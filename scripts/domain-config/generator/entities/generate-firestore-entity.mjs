#!/usr/bin/env node
import fs from "fs";
import path from "path";

// Firestore entity generator
// Usage:
//   node scripts/domain-config/generator/entities/generate-firestore-entity.mjs <Domain>

const args = process.argv.slice(2);
const domain = args[0];

if (!domain) {
  console.error("使い方: node scripts/domain-config/generator/entities/generate-firestore-entity.mjs <Domain>");
  process.exit(1);
}

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);

const configPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
const outputDir = path.join(process.cwd(), "src", "features", camel, "entities");
const outputFile = path.join(outputDir, "firestore.ts");

if (!fs.existsSync(configPath)) {
  console.error(`設定ファイルが見つかりません: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const collection = config.plural || `${camel}s`;

let content = `// src/features/${camel}/entities/firestore.ts\n\n`;
content += `export const collectionPath = "${collection}";\n`;

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, content);
console.log(`Firestore エンティティを生成しました: ${outputFile}`);
