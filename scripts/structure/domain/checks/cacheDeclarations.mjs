// 検査: 全ての登録の cache の宣言(登録の entity.json の "cache" と fork の上書きの cache、D353。廃止した cache.json は止める)。
// pnpm check domain(check.mjs)が回す。generate: false の登録にも掛ける(包んだ読みの生成器 pnpm generate cache は generate に関わらず宣言を読む)。
// ファイルは読まない(純粋な層): 宣言の読みは domain/workspace.mjs の readCacheDeclarations・readDomainRows。

import { cacheIssues } from "./cache.mjs";

/**
 * @param {ReturnType<typeof import("../domain/workspace.mjs").readCacheDeclarations>} declarations 読んだ宣言(全ての登録の分)
 * @param {string[]} [domainNames] 地区の地図のドメイン名の全部(readsDomains の在りか。無ければ宣言の並びのドメイン)
 * @returns {{ issues: string[], declared: string[] }} 問題(`[<登録名>] …`、cache.json は `[<ドメイン>]`)と宣言のある登録
 */
export function cacheDeclarationIssues(declarations, domainNames) {
  const domains = new Set(domainNames ?? declarations.map(({ row }) => row.name));
  const issues = [];
  const declared = [];
  for (const { row, registration, config, cache, problem } of declarations) {
    const label = registration ?? row.name;
    if (problem) {
      issues.push(`[${label}] ${problem}`);
      continue;
    }
    if (!cache) continue;
    declared.push(label);
    issues.push(...cacheIssues(cache, { domain: label, domains, config: config ?? undefined }).map((issue) => `[${label}] ${issue}`));
  }
  return { issues, declared };
}
