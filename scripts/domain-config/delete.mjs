#!/usr/bin/env node
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from '../../src/utils/stringCase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const prompt = inquirer.createPromptModule();

function normalizeName(name) {
  return name?.toLowerCase().replace(/[-_\s]/g, '') ?? '';
}

function createPluralCandidates(base) {
  if (!base) return [];
  const candidates = new Set();

  candidates.add(`${base}s`);

  if (/(?:[sxz]|[cs]h)$/i.test(base)) {
    candidates.add(`${base}es`);
  }

  if (/[bcdfghjklmnpqrstvwxyz]y$/i.test(base)) {
    candidates.add(`${base.slice(0, -1)}ies`);
  }

  return [...candidates];
}

function createSingularCandidates(base) {
  if (!base) return [];

  const candidates = new Set();
  let handled = false;

  if (/ies$/i.test(base) && base.length > 3) {
    candidates.add(base.slice(0, -3) + 'y');
    handled = true;
  }

  if (/(?:[sxz]|[cs]h)es$/i.test(base)) {
    candidates.add(base.slice(0, -2));
    handled = true;
  }

  if (!handled && /s$/i.test(base) && !/(?:ss|us|is)$/i.test(base)) {
    candidates.add(base.slice(0, -1));
  }

  return [...candidates];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function removeEmpty(set) {
  for (const value of set) {
    if (!value) {
      set.delete(value);
    }
  }
  return set;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function removeLinesByHref(filePath, hrefs) {
  if (!fs.existsSync(filePath)) return;
  const hrefSet = new Set(hrefs.filter(Boolean));
  if (hrefSet.size === 0) return;
  const patterns = [...hrefSet].map((href) => new RegExp(`href:\\s*["']${escapeRegExp(href)}["']`));
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const filtered = lines.filter((line) => !patterns.some((pattern) => pattern.test(line)));
  if (filtered.length === lines.length) return;
  fs.writeFileSync(filePath, filtered.join('\n'));
  console.log(`更新しました: ${filePath}`);
}

export default async function removeDomain(domain) {
  const normalizedSnake = toSnakeCase(domain) || domain;
  const pascal = toPascalCase(normalizedSnake);
  const camel = toCamelCase(normalizedSnake);
  const singularKebab = toKebabCase(camel || normalizedSnake);
  const featuresBase = path.join(rootDir, 'src', 'features');
  const featureCandidateSet = removeEmpty(new Set(uniqueStrings([domain, camel, pascal, singularKebab])));
  const singularCandidates = createSingularCandidates(camel);
  for (const singularCandidate of singularCandidates) {
    featureCandidateSet.add(singularCandidate);
    featureCandidateSet.add(toPascalCase(singularCandidate));
    featureCandidateSet.add(toKebabCase(singularCandidate));
  }
  const resolvedFeatureDir = resolveDir(featuresBase, ...featureCandidateSet);
  const canonicalSingular =
    (resolvedFeatureDir && path.basename(resolvedFeatureDir)) ||
    singularCandidates[0] ||
    camel;
  const featureDir = resolvedFeatureDir ?? path.join(featuresBase, canonicalSingular);
  const configPath = path.join(featureDir, 'domain.json');
  let plural = canonicalSingular === camel ? camel + 's' : camel;
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    plural = cfg.plural || plural;
  }

  const pluralCandidateSet = removeEmpty(new Set([
    plural,
    toCamelCase(plural),
    toPascalCase(plural),
    toKebabCase(plural),
  ]));
  for (const candidate of createPluralCandidates(canonicalSingular)) {
    pluralCandidateSet.add(candidate);
    pluralCandidateSet.add(toCamelCase(candidate));
    pluralCandidateSet.add(toPascalCase(candidate));
    pluralCandidateSet.add(toKebabCase(candidate));
  }
  const searchNameSet = removeEmpty(new Set([...featureCandidateSet, ...pluralCandidateSet]));

  const { confirm } = await prompt({
    type: 'input',
    name: 'confirm',
    message: '削除確認のため同じドメイン名（snake_case）を入力してください:',
  });
  if (confirm.trim() !== normalizedSnake) {
    console.log('ドメイン名が一致しないため中止しました。');
    return;
  }

  let pluralKebab = toKebabCase(plural);
  const adminBaseDir = path.join(rootDir, 'src', 'app', 'admin');
  const adminProtectedDir = path.join(adminBaseDir, '(protected)');
  const adminDir =
    resolveDir(adminProtectedDir, ...pluralCandidateSet, ...featureCandidateSet) ||
    resolveDir(adminBaseDir, ...pluralCandidateSet, ...featureCandidateSet);
  if (adminDir) {
    const adminFolderName = path.basename(adminDir);
    pluralKebab = adminFolderName;
    const adminCamel = toCamelCase(adminFolderName);
    pluralCandidateSet.add(adminCamel);
    pluralCandidateSet.add(adminFolderName);
    searchNameSet.add(adminCamel);
    searchNameSet.add(adminFolderName);
  }
  const searchDirs = findDomainDirs(path.join(rootDir, 'src', 'app'), [...searchNameSet])
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
  const menuCandidates = new Set([pluralKebab, plural, ...pluralCandidateSet]);
  const expandedMenuCandidates = new Set();
  for (const candidate of menuCandidates) {
    if (!candidate) continue;
    expandedMenuCandidates.add(candidate);
    expandedMenuCandidates.add(toKebabCase(candidate));
  }
  const hrefCandidates = [];
  for (const candidate of expandedMenuCandidates) {
    if (!candidate) continue;
    if (candidate.startsWith('/')) {
      hrefCandidates.push(candidate);
      continue;
    }
    if (candidate.startsWith('admin/')) {
      hrefCandidates.push(`/${candidate}`);
      continue;
    }
    hrefCandidates.push(`/admin/${candidate}`);
  }
  removeLinesByHref(menuPath, hrefCandidates);

  const schemaPath = path.join(rootDir, 'src', 'registry', 'schemaRegistry.ts');
  for (const candidate of featureCandidateSet) {
    removeLineContaining(schemaPath, `@/features/${candidate}/entities/drizzle`);
  }

  const servicePath = path.join(rootDir, 'src', 'registry', 'serviceRegistry.ts');
  const serviceNames = new Set();
  for (const candidate of featureCandidateSet) {
    const camelCandidate = toCamelCase(candidate);
    serviceNames.add(camelCandidate);
    removeLineContaining(servicePath, `@/features/${candidate}/services/server/${camelCandidate}Service`);
  }
  for (const serviceName of serviceNames) {
    removeLineContaining(servicePath, `${serviceName}: ${serviceName}Service`);
  }

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
