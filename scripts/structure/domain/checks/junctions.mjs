// 検査: 多対多の結びの登録(D354)。多対多の中間の表はいつも自分の登録 entities/<結びの登録名>/entity.json で、
// 関係の宣言は through: <結びの登録名> で名指すだけ(列や FK を書かない)。置き場は through を書いた側のドメイン、
// 同じ結びを through で名指せる関係は 1 つだけ、反対側の belongsToMany は through を書かない読むだけの参照。
// 結びの登録の形: 両側(through を書いた登録と関係の相手)を指す結び 2 本(belongsTo、手の表の形なら foreignKeys)・その 2 列の合成の主キー・registered:false。
// onDelete・FK の名前は宣言のまま(今動いている表の値を正にする、D354)。読むだけ(ファイルを読まない純関数)。規則の正: src/domains/README.md「Relation」

import { toCamelCase } from "../../../../src/lib/stringCase/index.mjs";
import { domainTableName } from "../domain/names.mjs";

/** 結びの登録が両側を指す列: belongsTo の fieldName か、手の表の形の foreignKeys の 1 列 → 指す登録名 */
function linksOf(junction, registrationOfTable) {
  const links = [];
  for (const relation of junction.config?.relations ?? []) {
    if (relation?.relationType !== "belongsTo") continue;
    links.push({ column: relation.fieldName, target: toCamelCase(relation.domain ?? ""), required: relation.required === true });
  }
  for (const foreignKey of junction.config?.foreignKeys ?? []) {
    const columns = foreignKey?.columns ?? [];
    if (columns.length !== 1) continue;
    links.push({ column: columns[0], target: registrationOfTable.get(foreignKey.references?.table) ?? null, required: true });
  }
  return links;
}

/**
 * @param {Map<string, { domain: string, config: object | null }>} registrations 全ドメインの登録名 → ドメインと entity.json
 * @returns {{ errors: { registrations: string[], message: string }[], junctions: Set<string> }} junctions = through で名指された結びの登録名
 */
export function junctionIssues(registrations) {
  const errors = [];
  const junctions = new Set();
  const claims = new Map(); // 結び → [{ owner, target }]
  const registrationOfTable = new Map();
  for (const [name, { config }] of registrations) {
    if (config) registrationOfTable.set(typeof config.table === "string" ? config.table : domainTableName(name, config), name);
  }
  for (const [owner, { domain, config }] of registrations) {
    (config?.relations ?? []).forEach((relation, index) => {
      if (relation?.relationType !== "belongsToMany") return;
      const where = `${owner}: relations[${index}] "${relation.domain ?? "?"}"`;
      const target = toCamelCase(relation.domain ?? "");
      if (relation.through === undefined) {
        // 読むだけの参照: 相手が自分への結びを through で名指していること
        const back = (registrations.get(target)?.config?.relations ?? []).some((other) => other?.relationType === "belongsToMany" && other.through !== undefined && toCamelCase(other.domain ?? "") === owner);
        if (!back) errors.push({ registrations: [owner, target], message: `${where}: belongsToMany に through(結びの登録名)が無く、相手 ${target} も through で ${owner} への結びを名指していません(持つ側に through: <結びの登録名>、反対側は何も書かない)` });
        return;
      }
      const name = typeof relation.through === "string" ? toCamelCase(relation.through) : "";
      const junction = registrations.get(name);
      if (!junction) {
        errors.push({ registrations: [owner], message: `${where}: through の ${JSON.stringify(relation.through)} の登録がありません(entities/<結びの登録名>/entity.json を ${domain} に)` });
        return;
      }
      if (junction.domain !== domain) {
        errors.push({ registrations: [owner, name], message: `${where}: 結びの登録 ${name} が ${owner} のドメイン ${domain} でなく ${junction.domain} にあります(置き場は through を書いた側のドメイン、D354)` });
        return;
      }
      junctions.add(name);
      claims.set(name, [...(claims.get(name) ?? []), { owner, target, where }]);
    });
  }
  for (const [name, users] of claims) {
    if (users.length > 1) {
      errors.push({ registrations: [name, ...users.map((u) => u.owner)], message: `${name}: 結びの登録を through で名指す関係が 2 つ以上あります(${users.map((u) => u.where).join(" / ")})。1 つの結びは 1 つの関係だけ(反対側は through を書かない)` });
      continue;
    }
    const [{ owner, target }] = users;
    const junction = registrations.get(name);
    const at = `${name}(${owner} → ${target} の結び)`;
    if (junction.config?.registered !== false) errors.push({ registrations: [name], message: `${at}: 結びの登録は registered: false にしてください(汎用の口と登録表に出さない)` });
    const links = linksOf(junction, registrationOfTable);
    const toOwner = links.filter((link) => link.target === owner);
    const toTarget = links.filter((link) => link.target === target);
    const expected = owner === target ? 2 : 1;
    if (links.length !== 2 || (owner === target ? toOwner.length !== 2 : toOwner.length !== expected || toTarget.length !== expected)) {
      errors.push({ registrations: [name], message: `${at}: 結びは ${owner} と ${target} を指す 2 本だけを持ちます(belongsTo か foreignKeys。今: ${links.map((l) => `${l.column} → ${l.target ?? "?"}`).join(", ") || "なし"})` });
      continue;
    }
    for (const link of links) if (!link.required) errors.push({ registrations: [name], message: `${at}: ${link.column} の belongsTo は required: true にしてください` });
    const primary = junction.config?.primaryKey?.columns;
    const columns = new Set(links.map((link) => link.column));
    if (!Array.isArray(primary) || primary.length !== 2 || !primary.every((column) => columns.has(column))) {
      errors.push({ registrations: [name], message: `${at}: 主キーは 2 本の結びの列の合成(primaryKey: { columns: [${[...columns].join(", ")}] })にしてください` });
    }
  }
  return { errors, junctions };
}
