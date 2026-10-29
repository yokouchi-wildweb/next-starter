// 検査: リレーション（Firestore で使えない種類・外部キーの名前と型）。
// 生成器は Firestore の hasMany / belongsToMany を黙って無視し、fieldName の無い外部キーは列名 undefined、
// pg-core に無い型（number など）は存在しない列関数を出すので、生成前に止める。
// 規則の正: src/features/README.md「Relation」

/** Firestore で使えないリレーション（生成器が何も出さない） */
const FIRESTORE_UNSUPPORTED = new Set(["hasMany", "belongsToMany"]);
/** 外部キー列を持つリレーション */
const KEY_RELATIONS = new Set(["belongsTo", "belongsToMany"]);
/** 外部キーの型（fieldType、無ければ主の idType）。Neon は列関数が要る型だけ */
const KEY_TYPES = {
  Neon: new Set(["uuid", "string", "integer"]),
  Firestore: new Set(["string", "number", "reference"]),
};

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題（空なら無し）
 */
export function relationIssues(config) {
  const issues = [];
  const keyTypes = KEY_TYPES[config.dbEngine];
  (config.relations ?? []).forEach((relation, index) => {
    const where = `relations[${index}] "${relation?.domain ?? "?"}"`;
    const type = relation?.relationType;
    if (config.dbEngine === "Firestore" && FIRESTORE_UNSUPPORTED.has(type)) {
      issues.push(`${where}: Firestore のドメインでは ${type} を使えません（生成器が何も出しません）`);
      return;
    }
    if (!KEY_RELATIONS.has(type)) return;
    if (typeof relation.fieldName !== "string" || relation.fieldName.length === 0) {
      issues.push(`${where}: ${type} には fieldName（外部キーの列名。例: ${relation?.domain ?? "x"}_id）を書いてください`);
    }
    const keyType = relation.fieldType ?? config.idType;
    if (keyTypes && keyType !== undefined && !keyTypes.has(keyType)) {
      issues.push(
        `${where}: 外部キーの型 "${keyType}"${relation.fieldType === undefined ? "（fieldType が無いので主の idType）" : ""} は使えません。` +
          `fieldType に ${[...keyTypes].join(" / ")} のどれかを書いてください（数値の ID は integer）`,
      );
    }
  });
  return issues;
}
