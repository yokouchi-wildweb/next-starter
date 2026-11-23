// src/lib/cacheTags/tag.ts — 札の名前の形(client でも server でも読める、入口 ".")

const MAX_TAG_LENGTH = 256;

/** 行の全部の札の印(id の分からない書き込みが消す。id には使えない) */
const ALL_ROWS = "*";

/**
 * ドメインの札 "<domain>"(list・名前付きの読み・件数が付け、そのドメインの書き込みが必ず消す)、
 * 行の札 "<domain>:<id>"(get が付け、その行の書き込みが消す)を作る。
 * 空の名前・空の id・id "*"(行の全部の札の印)・長さ 256 を超える札は投げる(Next が受けない札を黙って作らない)。
 */
export function cacheTagOf(domain: string, id?: string | number): string {
  if (!domain) throw new Error("cacheTagOf: domain が空です");
  if (domain.includes(":")) throw new Error(`cacheTagOf: domain に ":" は使えません: ${domain}`);
  let tag = domain;
  if (id !== undefined) {
    const idText = String(id);
    if (!idText) throw new Error(`cacheTagOf: ${domain} の id が空です`);
    if (idText === ALL_ROWS) throw new Error(`cacheTagOf: id "${ALL_ROWS}" は行の全部の札の印です(cacheRowsTagOf を使う)`);
    tag = `${domain}:${idText}`;
  }
  if (tag.length > MAX_TAG_LENGTH) {
    throw new Error(`cacheTagOf: 札が ${MAX_TAG_LENGTH} 字を超えます(${tag.length} 字): ${tag.slice(0, 40)}…`);
  }
  return tag;
}

/**
 * 行の全部の札 "<domain>:*"。get が行の札と一緒に付け、どの行を書いたか分からない書き込み
 * (条件の一括更新・並べ替え・置き換え・全削除)が消す。
 */
export function cacheRowsTagOf(domain: string): string {
  return `${cacheTagOf(domain)}:${ALL_ROWS}`;
}
