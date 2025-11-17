#!/usr/bin/env node
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import updateAdminDataMenu from './updateAdminDataMenu.mjs';
import updateSchemaRegistry from './updateSchemaRegistry.mjs';
import updateServiceRegistry from './updateServiceRegistry.mjs';
import { toCamelCase, toPlural } from '../../../../src/utils/stringCase.mjs';

const args = process.argv.slice(2);
const domain = args[0];

// ドメイン名が指定されていない場合は使い方を表示して終了
if (!domain) {
  console.error('使い方: node .../registry/index.mjs <Domain>');
  process.exit(1);
}

const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
const pascal = domain.charAt(0).toUpperCase() + domain.slice(1);


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..', '..');
const configPath = path.join(rootDir, 'src', 'features', camel, 'domain.json');

let label = pascal;
let plural = toPlural(camel);
let dbEngine = '';
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
}

updateAdminDataMenu({ rootDir, plural, label });
updateSchemaRegistry({ rootDir, camel, dbEngine });
updateServiceRegistry({ rootDir, camel });

