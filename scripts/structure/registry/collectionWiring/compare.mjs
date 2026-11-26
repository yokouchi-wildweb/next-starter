// 集まりの配線の突き合わせ: 登録の宣言 entity.json の集まりの項目（mediaCollection）と、登録表から読み込んだ主のサービスの
// collectionFields（createCrudService の collections オプション）が一致するかを比べる。
// 手書きの drizzleBase.ts（generate: false のドメイン）に collections を渡し忘れた主を、生成の後で見つける

import { nodeDomainSource, readDomains } from "../../../../src/lib/domain/node.mjs";

/**
 * 登録の宣言 entity.json の集まりの項目名（Neon の項目名は宣言に書いたまま = レコードのキー）。読むのは宣言の読み込みの部品 readDomain だけ
 * @param {string} repoRoot
 * @returns {Map<string, string[]>} 登録名（= serviceRegistry のキー）→ 項目名。集まりを持つ主だけ
 */
export function declaredCollections(repoRoot) {
  const declared = new Map();
  for (const declaration of readDomains(nodeDomainSource(repoRoot))) {
    for (const registration of declaration.registrations) {
      const names = (registration.entity?.fields ?? []).filter((field) => field.fieldType === "mediaCollection").map((field) => field.name);
      if (names.length) declared.set(registration.name, names);
    }
  }
  return declared;
}

/**
 * @param {{ declared: Map<string, string[]>, wired: Map<string, readonly string[] | null> }} input
 *   wired = 主のフォルダ名 → サービスの collectionFields（登録表に無ければ null）。declared に無い主の配線も見る
 * @returns {string[]} 食い違い（空なら一致）
 */
export function compareCollectionWiring({ declared, wired }) {
  const problems = [];
  for (const domain of new Set([...declared.keys(), ...wired.keys()])) {
    const want = declared.get(domain) ?? [];
    const have = wired.get(domain);
    if (have === null) {
      if (want.length) problems.push(`${domain}: serviceRegistry に登録が無い（集まりの項目 ${want.join(", ")} を配線できない）`);
      continue;
    }
    const haveSet = new Set(have ?? []);
    const missing = want.filter((name) => !haveSet.has(name));
    const extra = [...haveSet].filter((name) => !want.includes(name));
    if (missing.length) {
      problems.push(
        `${domain}: 集まりの項目 ${missing.join(", ")} がサービスに配線されていない（drizzleBase.ts の createCrudService に collections を渡す: ` +
          `import { collections } from "./collections"）`,
      );
    }
    if (extra.length) problems.push(`${domain}: サービスの collections に domain.json に無い項目 ${extra.join(", ")} がある`);
  }
  return problems;
}
