// 検査: リレーション（Firestore で使えない種類・外部キーの名前と型）。
// 生成器は Firestore の hasMany / belongsToMany を黙って無視し、fieldName の無い外部キーは列名 undefined、
// pg-core に無い型（number など）は存在しない列関数を出すので、生成前に止める。
// 規則の正: src/domains/README.md「Relation」。外部キーに使える型は型の表の foreignKey 属性（src/lib/domain/fields/fieldTypes.mjs）

import { foreignKeyFieldTypes } from "../spec/fieldTypes.mjs";

/** Firestore で使えないリレーション（生成器が何も出さない） */
const FIRESTORE_UNSUPPORTED = new Set(["hasMany", "belongsToMany"]);
/** 外部キー列を持つリレーション */
const KEY_RELATIONS = new Set(["belongsTo", "belongsToMany"]);

/**
 * @param {object} config 登録の entity.json
 * @returns {string[]} 問題（空なら無し）
 */
export function relationIssues(config) {
  const issues = [];
  const keyTypes = foreignKeyFieldTypes(config.dbEngine);
  (config.relations ?? []).forEach((relation, index) => {
    const where = `relations[${index}] "${relation?.domain ?? "?"}"`;
    const type = relation?.relationType;
    // 廃止した鍵(D354): 中間の表はいつも自分の登録で、関係は through で名指すだけ
    if (relation && Object.hasOwn(relation, "includeRelationTable")) {
      issues.push(`${where}: includeRelationTable は廃止しました(D354)。持つ側の関係に through: <結びの登録名>(entities/<結びの登録名>/entity.json、同じドメイン)を書き、反対側は何も書かない(読むだけの参照)`);
    }
    if (relation?.through !== undefined && type !== "belongsToMany") issues.push(`${where}: through は belongsToMany にだけ書けます`);
    if (config.dbEngine === "Firestore" && FIRESTORE_UNSUPPORTED.has(type)) {
      issues.push(`${where}: Firestore のドメインでは ${type} を使えません（生成器が何も出しません）`);
      return;
    }
    if (!KEY_RELATIONS.has(type)) return;
    if (typeof relation.fieldName !== "string" || relation.fieldName.length === 0) {
      issues.push(`${where}: ${type} には fieldName（外部キーの列名。例: ${relation?.domain ?? "x"}_id）を書いてください`);
    }
    const keyType = relation.fieldType ?? config.idType;
    if (keyTypes.size > 0 && keyType !== undefined && !keyTypes.has(keyType)) {
      issues.push(
        `${where}: 外部キーの型 "${keyType}"${relation.fieldType === undefined ? "（fieldType が無いので主の idType）" : ""} は使えません。` +
          `fieldType に ${[...keyTypes].join(" / ")} のどれかを書いてください（数値の ID は integer）`,
      );
    }
  });
  return issues;
}
