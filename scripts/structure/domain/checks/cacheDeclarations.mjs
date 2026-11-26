// 検査: 全ドメインの cache の宣言(主の登録の entity.json の "cache" か <domain>/cache.json)。pnpm check domain(check.mjs)が回す。
// generate: false と domain.json の無いドメインにも掛ける(生成の前の検査 --dry-run はそれらを通らないが、
// 包んだ読みの生成器 pnpm generate cache は generate に関わらず宣言を読む)。
// ファイルは読まない(純粋な層): 宣言の読みは domain/workspace.mjs の readCacheDeclarations・readDomainRows。

import { cacheIssues } from "./cache.mjs";

/**
 * @param {ReturnType<typeof import("../domain/workspace.mjs").readCacheDeclarations>} declarations 読んだ宣言(全ドメインの分)
 * @returns {{ issues: string[], declared: string[] }} 問題(`[<ドメイン>] …`)と宣言のあるドメイン
 */
export function cacheDeclarationIssues(declarations) {
  const domains = new Set(declarations.map(({ row }) => row.name));
  const issues = [];
  const declared = [];
  for (const { row, config, cache, problem } of declarations) {
    if (problem) {
      issues.push(`[${row.name}] ${problem}`);
      continue;
    }
    if (!cache) continue;
    declared.push(row.name);
    issues.push(...cacheIssues(cache, { domain: row.name, domains, config: config ?? undefined }).map((issue) => `[${row.name}] ${issue}`));
  }
  return { issues, declared };
}
