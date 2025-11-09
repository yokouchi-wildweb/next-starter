#!/usr/bin/env node
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import { toKebabCase } from '../../src/utils/stringCase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const prompt = inquirer.createPromptModule();

function normalizeName(name) {
  return name?.toLowerCase().replace(/[-_\s]/g, '') ?? '';
}

function findDomainDirs(base, names) {
  const result = [];
  if (!fs.existsSync(base)) return result;
  const entries = fs.readdirSync(base, { withFileTypes: true });
  const normalizedTargets = names.map(normalizeName).filter(Boolean);
  for (const entry of entries) {
    const full = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (normalizedTargets.includes(normalizeName(entry.name))) result.push(full);
      result.push(...findDomainDirs(full, names));
    }
  }
  return result;
}

function resolveDir(base, ...candidates) {
  if (!fs.existsSync(base)) return null;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const directPath = path.join(base, candidate);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
      return directPath;
    }
  }

  const entries = fs.readdirSync(base, { withFileTypes: true });
  const normalizedCandidates = candidates.map(normalizeName).filter(Boolean);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (normalizedCandidates.includes(normalizeName(entry.name))) {
      return path.join(base, entry.name);
    }
  }

  return null;
}

function removeLineContaining(filePath, keyword) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const filtered = lines.filter((l) => !l.includes(keyword));
  fs.writeFileSync(filePath, filtered.join('\n'));
  console.log(`更新しました: ${filePath}`);
}

export default async function removeDomain(domain) {
  const camel = domain.charAt(0).toLowerCase() + domain.slice(1);
  const featuresBase = path.join(rootDir, 'src', 'features');
  const resolvedFeatureDir = resolveDir(featuresBase, camel);
  const featureDir = resolvedFeatureDir ?? path.join(featuresBase, camel);
  const configPath = path.join(featureDir, 'domain.json');
  let plural = camel + 's';
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    plural = cfg.plural || plural;
  }

  const { confirm } = await prompt({
    type: 'input',
    name: 'confirm',
    message: '削除確認のため同じドメイン名（PascalCase）を入力してください:',
  });
  if (confirm !== domain) {
    console.log('ドメイン名が一致しないため中止しました。');
    return;
  }

  const pluralKebab = toKebabCase(plural);
  const adminBaseDir = path.join(rootDir, 'src', 'app', 'admin');
  const adminProtectedDir = path.join(adminBaseDir, '(protected)');
  const adminDir =
    resolveDir(adminProtectedDir, pluralKebab, plural, camel) ||
    resolveDir(adminBaseDir, pluralKebab, plural, camel);
  const searchDirs = findDomainDirs(path.join(rootDir, 'src', 'app'), [camel, plural, pluralKebab])
    .filter((d) => !adminDir || d !== adminDir);
  let extras = [];
  if (searchDirs.length > 0) {
    const res = await prompt({
      type: 'checkbox',
      name: 'extras',
      message: '追加で削除するディレクトリを選択:',
      choices: searchDirs.map((p) => ({ name: path.relative(rootDir, p), value: p })),
    });
    extras = res.extras;
  }

  let removeConfig = true;
  if (fs.existsSync(configPath)) {
    const ans = await prompt({
      type: 'confirm',
      name: 'removeConfig',
      message: 'domain.json も削除しますか?',
      default: false,
    });
    removeConfig = ans.removeConfig;
  }

  const paths = [];
  if (fs.existsSync(featureDir)) paths.push(path.relative(rootDir, featureDir));
  if (fs.existsSync(adminDir)) paths.push(path.relative(rootDir, adminDir));
  paths.push(...extras.map((d) => path.relative(rootDir, d)));

  console.log('以下を削除します:');
  paths.forEach((p) => console.log(` - ${p}`));

  const { proceed } = await prompt({
    type: 'confirm',
    name: 'proceed',
    message: '削除を実行しますか?',
    default: false,
  });
  if (!proceed) {
    console.log('削除をキャンセルしました。');
    return;
  }

  if (adminDir && fs.existsSync(adminDir)) fs.rmSync(adminDir, { recursive: true, force: true });

  if (fs.existsSync(featureDir)) {
    if (removeConfig) {
      fs.rmSync(featureDir, { recursive: true, force: true });
    } else {
      for (const entry of fs.readdirSync(featureDir)) {
        if (entry !== 'domain.json') {
          fs.rmSync(path.join(featureDir, entry), { recursive: true, force: true });
        }
      }
    }
  }

  for (const dir of extras) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const menuPath = path.join(rootDir, 'src', 'registry', 'adminDataMenu.ts');
  removeLineContaining(menuPath, `/admin/${pluralKebab}`);
  if (pluralKebab !== plural) {
    removeLineContaining(menuPath, `/admin/${plural}`);
  }
  const schemaPath = path.join(rootDir, 'src', 'registry', 'schemaRegistry.ts');
  removeLineContaining(schemaPath, `@/features/${camel}/entities/drizzle`);
  const servicePath = path.join(rootDir, 'src', 'registry', 'serviceRegistry.ts');
  removeLineContaining(servicePath, `@/features/${camel}/services/server/${camel}Service`);
  removeLineContaining(servicePath, `${camel}: ${camel}Service`);

  console.log('削除が完了しました。');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const domain = process.argv[2];
  if (!domain) {
    console.error('使い方: node scripts/domain-config/delete.mjs <Domain>');
    process.exit(1);
  }
  removeDomain(domain).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
