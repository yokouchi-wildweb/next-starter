// entities/drizzle.ts の秘匿カラム（config.hiddenColumns: string[]、TS プロパティ名）。
// createCrudService の全戻り値・他ドメインの withRelations 展開から null 置換される（詳細: src/lib/crud/README.md の hiddenColumns 節）

export function hiddenColumnsOf(config) {
  return Array.isArray(config.hiddenColumns) ? config.hiddenColumns : [];
}

/** hiddenColumns が fields / relations / システム列に実在するか。未知なら例外 */
export function validateHiddenColumns(config) {
  const hiddenColumns = hiddenColumnsOf(config);
  if (hiddenColumns.length === 0) return;
  const knownProps = new Set(["id"]);
  (config.relations || []).forEach((rel) => {
    if (rel.relationType === "belongsTo") knownProps.add(rel.fieldName);
  });
  (config.fields || []).forEach((f) => knownProps.add(f.name));
  if (config.useCreatedAt) knownProps.add("createdAt");
  if (config.useUpdatedAt) knownProps.add("updatedAt");
  if (config.useSoftDelete) knownProps.add("deletedAt");
  for (const col of hiddenColumns) {
    if (!knownProps.has(col)) {
      throw new Error(
        `エラー: hiddenColumns に未知のフィールド "${col}" が指定されています\n` +
          "  domain.json の fields / relations に存在するプロパティ名（camelCase）で指定してください",
      );
    }
  }
}

/** テーブル定義直後の defineHiddenColumns(...) 宣言（import 順序に依存せず参照させるため） */
export function renderHiddenColumnsDeclaration(pascal, hiddenColumns) {
  if (hiddenColumns.length === 0) return "";
  const list = hiddenColumns.map((c) => `"${c}"`).join(", ");
  return (
    `\n// 秘匿カラム宣言: サービスの全戻り値・withRelations 展開から null 置換される\n` +
    `// (詳細: src/lib/crud/README.md の hiddenColumns 節)\n` +
    `defineHiddenColumns(${pascal}Table, [${list}]);\n`
  );
}
