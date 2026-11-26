// pnpm generate domain -- --delete の名前解決: 入力のドメイン名から、ドメインフォルダ・管理画面ルート・レジストリの候補名を広く集める
// （単数・複数、camel / Pascal / kebab の揺れを吸収する）。レジストリのキーの決定は registries.mjs

import fs from "node:fs";
import path from "node:path";
import { ENTITIES_DIR, ENTITY_DECLARATION_FILE } from "../../../../../src/lib/domain/node.mjs";
import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "../../../../../src/lib/stringCase/index.mjs";

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
 * @returns {{ normalizedSnake: string, camel: string, domainDir: string, configPath: string, canonicalSingular: string, plural: string,
 *   domainCandidateSet: Set<string>, pluralCandidateSet: Set<string>, searchNameSet: Set<string> }}
 */
export function resolveDeleteTarget(workspace, domain) {
  const normalizedSnake = toSnakeCase(domain) || domain;
  const pascal = toPascalCase(normalizedSnake);
  const camel = toCamelCase(normalizedSnake);
  const singularKebab = toKebabCase(camel || normalizedSnake);
  const domainCandidateSet = removeEmpty(new Set([domain, camel, pascal, singularKebab].filter(Boolean)));
  const singularCandidates = createSingularCandidates(camel);
  for (const singularCandidate of singularCandidates) {
    domainCandidateSet.add(singularCandidate);
    domainCandidateSet.add(toPascalCase(singularCandidate));
    domainCandidateSet.add(toKebabCase(singularCandidate));
  }
  // business（src/domains/<d>）を先に、無ければ宣言(主の登録)を持つ core（src/domains/core/<d>）
  const coreDomainDir = resolveDir(path.join(workspace.domainsDir, "core"), ...domainCandidateSet);
  const resolvedDomainDir =
    resolveDir(workspace.domainsDir, ...[...domainCandidateSet].filter((name) => name !== "core")) ??
    (coreDomainDir && workspace.readConfigLenient(path.basename(coreDomainDir)) ? coreDomainDir : null);
  const canonicalSingular = (resolvedDomainDir && path.basename(resolvedDomainDir)) || singularCandidates[0] || camel;
  const domainDir = resolvedDomainDir ?? path.join(workspace.domainsDir, canonicalSingular);
  const configPath = path.join(domainDir, ENTITIES_DIR, canonicalSingular, ENTITY_DECLARATION_FILE);
  let plural = canonicalSingular === camel ? camel + "s" : camel;
  // 主の登録の entity.json の plural(宣言の読み込みの部品で読む)
  plural = workspace.readConfigLenient(canonicalSingular)?.plural || plural;

  const pluralCandidateSet = removeEmpty(new Set([plural, toCamelCase(plural), toPascalCase(plural), toKebabCase(plural)]));
  for (const candidate of createPluralCandidates(canonicalSingular)) {
    pluralCandidateSet.add(candidate);
    pluralCandidateSet.add(toCamelCase(candidate));
    pluralCandidateSet.add(toPascalCase(candidate));
    pluralCandidateSet.add(toKebabCase(candidate));
  }
  const searchNameSet = removeEmpty(new Set([...domainCandidateSet, ...pluralCandidateSet]));
  return { normalizedSnake, camel, domainDir, configPath, canonicalSingular, plural, domainCandidateSet, pluralCandidateSet, searchNameSet };
}
