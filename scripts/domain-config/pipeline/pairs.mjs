// 主と従属の組（主の集まりの項目 mediaCollection → 従属ドメイン）を、1 回の生成につき一度だけ解く。
// 全 domain.json と、この実行で書き出す従属の中身（ディスクにまだ無い）から、従属 → 主・主 → 従属の対応を作る。
// 組の前提の誤り（従属の名前が無い・従属を所有する主が 2 つ以上）は全件集め、何も書く前に止める。
// 組を解いた後の生成順は「従属 → 主」。集まりの無いドメインの順と出力は変えない

import { domainTableName } from "../domain/names.mjs";
import { buildChildDomainConfig } from "../render/collections/childDomainConfig.mjs";
import { isCollectionFieldType } from "../spec/fieldTypes.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

/**
 * @typedef {object} PairIndex
 * @property {Map<string, string>} ownerOf 従属のフォルダ名 → 主のフォルダ名
 * @property {Map<string, string[]>} childrenOf 主のフォルダ名 → 従属のフォルダ名（項目の順）
 * @property {Map<string, object>} pending この実行で書き出す従属（domain.json がまだ無い）→ その中身
 * @property {{ domains: string[], message: string }[]} errors 組の前提の誤り（関わるドメインと文）
 */

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @returns {PairIndex}
 */
export function resolvePairs(workspace) {
  const ownerOf = new Map();
  const childrenOf = new Map();
  const pending = new Map();
  const errors = [];
  const claims = new Map(); // 従属 → それを宣言した主の一覧

  for (const owner of workspace.listDomains()) {
    const config = workspace.readConfigLenient(workspace.configPath(owner));
    for (const field of config?.fields ?? []) {
      if (!isCollectionFieldType(field?.fieldType)) continue;
      const childSingular = field.collection?.domain;
      if (typeof childSingular !== "string" || childSingular.trim() === "") {
        errors.push({
          domains: [owner],
          message: `${owner}: 集まりの項目 "${field?.name ?? "?"}" に従属のドメイン名（collection.domain）がありません`,
        });
        continue;
      }
      const child = toCamelCase(childSingular);
      claims.set(child, [...(claims.get(child) ?? []), owner]);
      if (!ownerOf.has(child)) {
        ownerOf.set(child, owner);
        childrenOf.set(owner, [...(childrenOf.get(owner) ?? []), child]);
        if (!workspace.exists(workspace.configPath(child))) pending.set(child, buildChildDomainConfig(config, field).config);
      }
    }
  }
  for (const [child, owners] of claims) {
    if (owners.length > 1) {
      errors.push({ domains: [child, ...owners], message: `${child}: 従属を所有する主が 2 つ以上あります（${owners.join(", ")}）。1 つの従属は 1 つの主にだけ属します` });
    }
  }
  return { ownerOf, childrenOf, pending, errors };
}

/** 組（主の従属 → 主）。組に属さないドメインは自分だけ */
export function groupOf(pairs, domain) {
  const owner = pairs.ownerOf.get(domain) ?? domain;
  const children = pairs.childrenOf.get(owner) ?? [];
  return children.length > 0 ? [...children, owner] : [domain];
}

/**
 * 組の誤りがあれば全件を並べて例外（何も書く前に呼ぶ）。domains を渡すと、そのどれかに関わる誤りだけを見る
 * @param {PairIndex} pairs
 * @param {string[] | null} [domains]
 */
export function assertPairs(pairs, domains = null) {
  const scope = domains ? new Set(domains) : null;
  const errors = pairs.errors.filter((error) => !scope || error.domains.some((domain) => scope.has(domain)));
  if (errors.length > 0) {
    throw new Error(`主と従属の組に誤りがあるため、何も生成せずに終了します:\n${errors.map((error) => `  - ${error.message}`).join("\n")}`);
  }
}

/** 生成の順: 従属は所有する主の直前（主が並びに無ければ元の位置）。それ以外の順は変えない */
export function orderWithPairs(pairs, domains) {
  const selected = new Set(domains);
  const ordered = [];
  const push = (domain) => {
    if (!ordered.includes(domain)) ordered.push(domain);
  };
  for (const domain of domains) {
    const owner = pairs.ownerOf.get(domain);
    if (owner && selected.has(owner)) continue; // 主の番で出す
    for (const child of pairs.childrenOf.get(domain) ?? []) if (selected.has(child)) push(child);
    push(domain);
  }
  return ordered;
}

/** この実行に組が関わるか（関わらなければ一覧を出さず、今までと同じ出力にする） */
export function involvesPairs(pairs, domains) {
  return domains.some((domain) => pairs.ownerOf.has(domain) || pairs.childrenOf.has(domain));
}

/**
 * 生成の最後の一覧: 書き出した domain.json / db:push が要る表（この実行で新しく書き出した従属の表だけ）/ コミットに含めるもの
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {PairIndex} pairs
 * @param {string[]} domains この実行で生成したドメイン
 * @param {{ registry: boolean, dryRun: boolean }} options
 * @returns {string[]}
 */
export function pairSummary(workspace, pairs, domains, { registry, dryRun }) {
  const written = domains.filter((domain) => pairs.pending.has(domain));
  const prefix = dryRun ? "[dry-run][組] " : "[組] ";
  const none = "なし";
  const paths = written.map((domain) => workspace.configPath(domain));
  const tables = written.map((domain) => domainTableName(domain, pairs.pending.get(domain)));
  const commit = [...written.map((domain) => `${workspace.featurePath(domain)}/`), ...(registry ? ["src/registry/ の登録表"] : [])];
  return [
    `${prefix}${dryRun ? "書き出す予定の" : "書き出した"} domain.json: ${paths.join(", ") || none}`,
    `${prefix}db:push が要る表: ${tables.length ? `${tables.join(", ")}（pnpm db:push を実行してください）` : none}`,
    `${prefix}コミットに含めるもの: ${commit.join(", ") || none}`,
  ];
}
