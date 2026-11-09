// scripts/structure/extensions/derive/gateRequires.mjs
// 機能を閉じる規則の requires の被覆(D24・D27・D34 K5、derive featureTables の一部。生成で止める):
// 機能 X の features のドメイン d が requires する(domainEntry.ts の requires、地区の地図の読み手 src/lib/districtMap)ドメイン e は、
// X の features・X の dependsOn の先(推移的)の features・基盤(どの規則の features にも載らないドメイン)のどれかに無ければ止める。
// = X が開なのに e が閉じている組み合わせを作れない(e を読む d が壊れない)。直し方: X の dependsOn に e を持つ機能を足す(か e を X の features に入れる)。
// 上流の例外は理由つきの縮む表(当たらない行は失敗)

/** 上流の例外: "<機能>:<ドメインのフォルダ>→<requires の先のフォルダ>" → 理由 */
export const REQUIRES_EXCEPTIONS = {};

/**
 * @param {{ path: string, name: string, domains: string[], dependsOn: string[] }[]} items 規則の項目(読めた物)
 * @param {{ folder: string, name: string, requires: string[] }[]} districts features の地区(フォルダは src/features からの相対)
 * @param {Record<string, string>} [exceptions]
 * @returns {string[]} problems
 */
export function checkRequiresCoverage(items, districts, exceptions = REQUIRES_EXCEPTIONS) {
  const problems = [];
  const folderOfName = new Map(districts.map((d) => [d.name, d.folder]));
  const requiresOf = new Map(districts.map((d) => [d.folder, d.requires]));
  const byName = new Map(items.map((item) => [item.name, item]));
  const holders = new Map();
  for (const item of items) for (const folder of item.domains) holders.set(folder, [...(holders.get(folder) ?? []), item.name]);
  const reach = (name) => {
    const seen = new Set();
    const queue = [name];
    while (queue.length > 0) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      queue.push(...(byName.get(current)?.dependsOn ?? []));
    }
    return seen;
  };
  const used = new Set();
  for (const item of items) {
    const reachable = reach(item.name);
    const covered = new Set([...reachable].flatMap((name) => byName.get(name)?.domains ?? []));
    for (const folder of item.domains) {
      for (const requiredName of requiresOf.get(folder) ?? []) {
        const target = folderOfName.get(requiredName) ?? requiredName;
        if (!holders.has(target) || covered.has(target)) continue;
        const key = `${item.name}:${folder}→${target}`;
        if (key in exceptions) {
          used.add(key);
          continue;
        }
        const owners = holders.get(target).join("・");
        problems.push(
          `${item.path}: 機能 ${item.name} のドメイン ${folder} が requires する ${requiredName}(${target}、機能 ${owners})が、この機能・依存先(dependsOn、推移的)・基盤のどれにも無い。dependsOn に ${holders.get(target).map((n) => `"${n}"`).join(" か ")} を足す(か ${target} を features に入れる)`,
        );
      }
    }
  }
  // 当たらない行は失敗(その機能の規則がある時だけ。規則の無い fixture・その規則を消した fork では数えない)
  for (const key of Object.keys(exceptions)) {
    if (!used.has(key) && byName.has(key.split(":")[0])) problems.push(`scripts/structure/extensions/derive/gateRequires.mjs: requires の被覆の例外 "${key}" はもう当たらない(行を消す)`);
  }
  return problems;
}
