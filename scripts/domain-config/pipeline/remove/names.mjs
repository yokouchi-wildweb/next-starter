// dc:delete の名前解決: 入力のドメイン名から、ドメインフォルダ・管理画面ルート・レジストリの候補名を広く集める
// （単数・複数、camel / Pascal / kebab の揺れを吸収する）。レジストリのキーの決定は registries.mjs

import fs from "node:fs";
import path from "node:path";
import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";

export function normalizeName(name) {
  return name?.toLowerCase().replace(/[-_\s]/g, "") ?? "";
}

export function createPluralCandidates(base) {
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

export function createSingularCandidates(base) {
  if (!base) return [];
  const candidates = new Set();
  let handled = false;
  if (/ies$/i.test(base) && base.length > 3) {
    candidates.add(base.slice(0, -3) + "y");
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

function removeEmpty(set) {
  for (const value of set) {
    if (!value) set.delete(value);
  }
  return set;
}

/** base 配下を再帰し、候補名（表記の揺れを無視）に一致するディレクトリを集める */
export function findDomainDirs(base, names) {
  const result = [];
  if (!fs.existsSync(base)) return result;
  const normalizedTargets = names.map(normalizeName).filter(Boolean);
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const full = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (normalizedTargets.includes(normalizeName(entry.name))) result.push(full);
      result.push(...findDomainDirs(full, names));
    }
  }
  return result;
}

/** base 直下で候補名に一致するディレクトリ（完全一致を優先し、無ければ表記の揺れを無視して探す） */
export function resolveDir(base, ...candidates) {
  if (!fs.existsSync(base)) return null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const directPath = path.join(base, candidate);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
      return directPath;
    }
  }
  const normalizedCandidates = candidates.map(normalizeName).filter(Boolean);
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (normalizedCandidates.includes(normalizeName(entry.name))) {
      return path.join(base, entry.name);
    }
  }
  return null;
}

/**
 * 入力のドメイン名から削除対象の名前を解決する
 * @returns {{ normalizedSnake: string, camel: string, featureDir: string, configPath: string, canonicalSingular: string, plural: string,
 *   featureCandidateSet: Set<string>, pluralCandidateSet: Set<string>, searchNameSet: Set<string> }}
 */
export function resolveDeleteTarget(workspace, domain) {
  const normalizedSnake = toSnakeCase(domain) || domain;
  const pascal = toPascalCase(normalizedSnake);
  const camel = toCamelCase(normalizedSnake);
  const singularKebab = toKebabCase(camel || normalizedSnake);
  const featureCandidateSet = removeEmpty(new Set([domain, camel, pascal, singularKebab].filter(Boolean)));
  const singularCandidates = createSingularCandidates(camel);
  for (const singularCandidate of singularCandidates) {
    featureCandidateSet.add(singularCandidate);
    featureCandidateSet.add(toPascalCase(singularCandidate));
    featureCandidateSet.add(toKebabCase(singularCandidate));
  }
  const resolvedFeatureDir = resolveDir(workspace.featuresDir, ...featureCandidateSet);
  const canonicalSingular = (resolvedFeatureDir && path.basename(resolvedFeatureDir)) || singularCandidates[0] || camel;
  const featureDir = resolvedFeatureDir ?? path.join(workspace.featuresDir, canonicalSingular);
  const configPath = path.join(featureDir, "domain.json");
  let plural = canonicalSingular === camel ? camel + "s" : camel;
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    plural = cfg.plural || plural;
  }

  const pluralCandidateSet = removeEmpty(new Set([plural, toCamelCase(plural), toPascalCase(plural), toKebabCase(plural)]));
  for (const candidate of createPluralCandidates(canonicalSingular)) {
    pluralCandidateSet.add(candidate);
    pluralCandidateSet.add(toCamelCase(candidate));
    pluralCandidateSet.add(toPascalCase(candidate));
    pluralCandidateSet.add(toKebabCase(candidate));
  }
  const searchNameSet = removeEmpty(new Set([...featureCandidateSet, ...pluralCandidateSet]));
  return { normalizedSnake, camel, featureDir, configPath, canonicalSingular, plural, featureCandidateSet, pluralCandidateSet, searchNameSet };
}
