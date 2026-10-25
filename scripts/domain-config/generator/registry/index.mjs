#!/usr/bin/env node
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import updateAdminDataMenu from './updateAdminDataMenu.mjs';
import updateDomainConfigRegistry from './updateDomainConfigRegistry.mjs';
import updateSchemaRegistry from './updateSchemaRegistry.mjs';
import writeDomainEntry from './writeDomainEntry.mjs';
import updateStoragePurposeRegistry from './updateStoragePurposeRegistry.mjs';
import { toCamelCase, toPascalCase, toPlural } from '../../../../src/utils/stringCase.mjs';
import { generateServiceRegistry } from '../../../registry/serviceRegistry/generate.mjs';

const args = process.argv.slice(2);
const domain = args[0];
// 一括生成（dc:generate:all）から呼ばれたときは serviceRegistry.ts を作り直さない（全ドメインの domainEntry.ts を書いた後に呼び手が 1 回だけ作る。
// ドメインごとに作り直すと、まだ domainEntry.ts の無い他のドメインで検査が失敗して途中で止まる）
const deferServiceRegistry = args.includes('--defer-service-registry');

// ドメイン名が指定されていない場合は使い方を表示して終了
if (!domain) {
  console.error('使い方: node .../registry/index.mjs <Domain>');
  process.exit(1);
}

const camel = toCamelCase(domain) || domain;
const pascal = toPascalCase(domain) || domain;


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..', '..');
const configPath = path.join(rootDir, 'src', 'features', camel, 'domain.json');

let label = pascal;
let plural = toPlural(camel);
let dbEngine = "";
let addToAdminDataMenu = false;
// 設定ファイルがあればラベルや複数形、DBエンジンを読み込む
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  label = config.label || label;
  if (config.plural) {
    plural = toCamelCase(config.plural);
  }
  if (config.dbEngine) {
    dbEngine = config.dbEngine;
  }
  addToAdminDataMenu = Boolean(config.addToAdminDataMenu);
}

if (addToAdminDataMenu) {
  updateAdminDataMenu({ rootDir, plural, label });
}
updateDomainConfigRegistry({ rootDir, camel });
updateSchemaRegistry({ rootDir, camel, dbEngine });
writeDomainEntry({ rootDir, camel });
updateStoragePurposeRegistry({ rootDir, camel });
// 登録表はこのドメインの domainEntry.ts を含めて丸ごと作り直す（失敗 = 他の domainEntry.ts や手書き行の不整合。メッセージの直し方に従う）
if (!deferServiceRegistry) {
  try {
    generateServiceRegistry(rootDir);
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
