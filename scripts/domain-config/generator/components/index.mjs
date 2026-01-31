#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

import generateAdminCreate from './adminCreate.mjs';
import generateAdminEdit from './adminEdit.mjs';
import generateAdminListIndex from './adminListIndex.mjs';
import generateAdminListHeader from './adminListHeader.mjs';
import generateAdminListTable from './adminListTable.mjs';
import generateCreateForm from './createForm.mjs';
import generateEditForm from './editForm.mjs';
import generateDomainForm from './domainForm.mjs';
import generateDomainFields from './domainFields.mjs';
import generateDetailModal from './detailModal.mjs';
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toKebabCase,
} from '../../../../src/utils/stringCase.mjs';

// 各種コンポーネントをまとめて生成するエントリースクリプト

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === '--plural' || a === '-p');
// --plural オプションがあれば複数形を取得
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

// ドメイン名が無い場合は使い方を表示して終了
if (!domain) {
  console.error(
    '使い方: node scripts/domain-config/generator/components/index.mjs <Domain> [--plural <plural>]'
  );
  process.exit(1);
}

const camel = toCamelCase(domain) || domain;
const pascal = toPascalCase(domain) || domain;


const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const configPath = path.join(
  process.cwd(),
  'src',
  'features',
  camel,
  'domain.json'
);
let domainConfig = null;
if (fs.existsSync(configPath)) {
  domainConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const outputDir = path.join(
  process.cwd(),
  'src',
  'features',
  camel,
  'components'
);

const kebab = toKebabCase(camel);
const kebabPlural = toKebabCase(camelPlural);

const label = domainConfig?.label ?? pascal;

const tokens = { camel, pascal, camelPlural, pascalPlural, kebab, kebabPlural, label };

const generators = [
  generateAdminCreate,
  generateAdminEdit,
  generateAdminListIndex,
  (opts) => generateAdminListHeader({ ...opts, config: domainConfig }),
  (opts) => generateAdminListTable({ ...opts, config: domainConfig }),
  generateCreateForm,
  (opts) => generateEditForm({ ...opts, config: domainConfig }),
  (opts) => generateDomainForm({ ...opts, config: domainConfig }),
  (opts) => generateDomainFields({ ...opts, config: domainConfig }),
];

if (domainConfig?.useDetailModal) {
  generators.push((opts) => generateDetailModal({ ...opts, config: domainConfig }));
}

// 各ジェネレーターを順に実行
generators.forEach((g) => g({ ...tokens }));
