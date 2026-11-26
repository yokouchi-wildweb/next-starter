// entities/<登録名>/drizzle.ts の表の単位の手で持つ形(宣言の鍵 primaryKey・foreignKeys・checks): pgTable の第 3 引数の項目と、列の主キー。
// 列・enum の形は ./shape.mjs。外部キーの相手の表のファイルは workspace が読む(この層はファイルを読まない)

/** リポジトリ相対のファイル(src/...)→ import の道(@/...、拡張子なし) */
export function importPathOf(file) {
  if (!file.startsWith("src/")) throw new Error(`エラー: "${file}" はリポジトリ直下からの src/ で始まる道で書く`);
  return `@/${file.slice("src/".length).replace(/\.(ts|tsx|mts|mjs|js)$/, "")}`;
}

/** 主キーが名前なしの 1 列 = 列の .primaryKey()(DB の制約名は <表>_pkey。primaryKey() の制約にすると名前が変わる) */
export const isColumnPrimaryKey = (config) => config.primaryKey?.columns?.length === 1 && !config.primaryKey.name;

/** 列の主キーをその項目の行に付ける(項目がまだ無ければ何もしない) */
export function markColumnPrimaryKey(config, lines) {
  if (!isColumnPrimaryKey(config)) return lines;
  const prefix = `  ${config.primaryKey.columns[0]}: `;
  return lines.map((line) => (line.startsWith(prefix) && line.endsWith(",") ? `${line.slice(0, -1)}.primaryKey(),` : line));
}

/** @param {string[]} columns */
const tableColumns = (columns) => columns.map((column) => `table.${column}`).join(", ");

/**
 * pgTable の第 3 引数の項目(primaryKey・foreignKeys・checks)と、相手の表の import の行
 * @param {object} config
 * @param {string} tableName この表の物理名(自己参照の判定)
 * @param {(physicalName: string) => { file: string, text: string } | null} tableFileOf 物理名の表の定義ファイルと本文(workspace.tableFileOf。この層はファイルを読まない)
 * @param {string} selfFile この表の定義ファイル(リポジトリ相対)
 * @param {Set<string>} imports
 * @param {{ sql: boolean }} needs
 * @returns {{ entries: string[], importLines: string[] }}
 */
export function tableShapeEntries(config, tableName, tableFileOf, selfFile, imports, needs) {
  const entries = [];
  const importLines = new Set();
  if (config.primaryKey && !isColumnPrimaryKey(config)) {
    imports.add("primaryKey");
    const { columns, name } = config.primaryKey;
    entries.push(`  primaryKey({ ${name ? `name: "${name}", ` : ""}columns: [${tableColumns(columns)}] })`);
  }
  for (const fk of config.foreignKeys ?? []) {
    imports.add("foreignKey");
    const target = fk.references.table === tableName ? { name: "table", importLine: null } : foreignTableExport(tableFileOf, fk.references.table, selfFile);
    if (target.importLine) importLines.add(target.importLine);
    const foreign = fk.references.columns.map((column) => `${target.name}.${column}`).join(", ");
    let entry = `  foreignKey({ ${fk.name ? `name: "${fk.name}", ` : ""}columns: [${tableColumns(fk.columns)}], foreignColumns: [${foreign}] })`;
    if (fk.onDelete) entry += `.onDelete("${fk.onDelete.toLowerCase().replace("_", " ")}")`;
    if (fk.onUpdate) entry += `.onUpdate("${fk.onUpdate.toLowerCase().replace("_", " ")}")`;
    entries.push(entry);
  }
  for (const entry of config.checks ?? []) {
    imports.add("check");
    needs.sql = true;
    entries.push(`  check("${entry.name}", sql\`${entry.sql}\`)`);
  }
  return { entries, importLines: [...importLines] };
}

/**
 * 物理名の表の定義の export を、表の定義ファイル(workspace が地区の地図の tableFiles から引く)の字面から引く
 * @returns {{ name: string, importLine: string | null }}
 */
function foreignTableExport(tableFileOf, foreignTable, selfFile) {
  const found = tableFileOf(foreignTable);
  if (!found) throw new Error(`エラー: foreignKeys の references.table "${foreignTable}" の表がどのドメインにもありません`);
  const { text } = found;
  const match = new RegExp(`export const (\\w+)\\s*=\\s*pgTable\\(\\s*["'\`]${foreignTable}["'\`]`).exec(text);
  if (!match) throw new Error(`エラー: ${found.file} の表 "${foreignTable}" は export const <名前> = pgTable("${foreignTable}", …) の形でない`);
  if (found.file === selfFile) return { name: match[1], importLine: null };
  return { name: match[1], importLine: `import { ${match[1]} } from "${importPathOf(found.file)}";` };
}
