// 集まりの配線の突き合わせ: domain.json の集まりの項目（mediaCollection）と、登録表から読み込んだ主のサービスの
// collectionFields（createCrudService の collections オプション）が一致するかを比べる。
// 手書きの drizzleBase.ts（generateFiles.serverServices: false）に collections を渡し忘れた主を、生成の後で見つける

import fs from "node:fs";
import path from "node:path";

const NOT_DOMAIN_DIRS = new Set(["_template", "core"]);

/**
 * src/features/<domain>/domain.json の集まりの項目名（Neon の項目名は domain.json に書いたまま = レコードのキー）
 * @param {string} repoRoot
 * @returns {Map<string, string[]>} フォルダ名（= serviceRegistry のキー）→ 項目名。集まりを持つ主だけ
 */
export function declaredCollections(repoRoot) {
  const featuresDir = path.join(repoRoot, "src", "features");
  const declared = new Map();
  for (const dirent of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!dirent.isDirectory() || NOT_DOMAIN_DIRS.has(dirent.name)) continue;
    const configPath = path.join(featuresDir, dirent.name, "domain.json");
    if (!fs.existsSync(configPath)) continue;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const names = (config.fields ?? []).filter((field) => field.fieldType === "mediaCollection").map((field) => field.name);
    if (names.length) declared.set(dirent.name, names);
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
