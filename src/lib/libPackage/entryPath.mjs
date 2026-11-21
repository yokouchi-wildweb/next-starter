// src/lib/libPackage/entryPath.mjs
//
// 入口の照合の形(index.mjs の findEntry と node.mjs の形の検査が同じ物を使う)。lib の中だけで読む(入口ではない)

/** exports の値に使える拡張子 */
export const ENTRY_EXTENSIONS = Object.freeze(["ts", "tsx", "mts", "mjs", "js"]);

export const EXT_RE = new RegExp(`\\.(${ENTRY_EXTENSIONS.join("|")})$`);

/**
 * 区切りを / にそろえる(node:path を読まない。Windows の \ も / にする)
 * @param {string} p
 * @returns {string}
 */
export const toPosix = (p) => p.replaceAll("\\", "/");

/**
 * 拡張子と末尾の /index を落とした形(入口の照合用。"" = lib の根)
 * @param {string} relInsideLib
 * @returns {string}
 */
export function entryPathOf(relInsideLib) {
  let p = relInsideLib.replace(/^\.\/?/, "").replace(EXT_RE, "");
  if (p === "index") return "";
  if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
  return p;
}
