// src/app の全ページの発見(M1)。test:screens とルート地図(routeMap.mjs)が共有する。
// 固定の走査範囲は持たない: src/app 全体を見て、`_` で始まるフォルダ(private folder)と src/app/api だけを外す。
// @slot(parallel routes)は外さない(URL には出ないが、ページとして描かれる)。
// discoverRoutes は純粋関数(ファイル一覧を引数で受け取る)。ディスクを読むのは listAppFiles だけ。
// 設計: src/lib/screens/README.md §9・§13
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const APP_DIR = "src/app";
/** ルートの外として扱う src/app 直下のディレクトリ(API route は page 層ではない) */
export const NON_PAGE_AREAS = ["src/app/api"];
/** Next.js がページとして扱うファイル */
export const PAGE_FILE_RE = /^page\.(tsx|ts|jsx|js|mdx)$/;
/** Next.js が layout として扱うファイル */
export const LAYOUT_FILE_RE = /^layout\.(tsx|ts|jsx|js)$/;

const isUnder = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);

/** route group `(name)`。intercepting の `(.)x` `(..)x` `(...)x` は group ではない */
const isGroupSegment = (seg) => /^\([^().][^()]*\)$/.test(seg);
const isSlotSegment = (seg) => seg.startsWith("@");

/**
 * ルートの一覧を作る。
 * @param {string[]} files repo 相対・`/` 区切りのファイルパス(src/app 配下。余分なものが混ざっていてもよい)
 * @returns {{ routes: Array<{ page: string, dir: string, url: string, slots: string[], key: string, layouts: string[] }>, problems: string[] }}
 *   - url: (group) と @slot を落とした URL。動的セグメント([slug] 等)と intercepting の印((.)x 等)はそのまま
 *   - slots: 経路上の @slot 名(無ければ空)。key = url + " @slot"(slot 内のページは親ページと別の行になる)
 *   - layouts: 祖先(src/app 自身を含む)→ ページ自身の dir の順に、存在する layout ファイル
 *   - problems: 同じ key のページが 2 つある(Next もビルドで失敗する構成)など
 */
export function discoverRoutes(files) {
  const inApp = files
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => isUnder(f, APP_DIR) && !NON_PAGE_AREAS.some((a) => isUnder(f, a)))
    .filter((f) => !f.slice(APP_DIR.length + 1).split("/").slice(0, -1).some((seg) => seg.startsWith("_")));

  const layoutByDir = new Map();
  for (const f of inApp) {
    const name = f.slice(f.lastIndexOf("/") + 1);
    if (LAYOUT_FILE_RE.test(name)) layoutByDir.set(f.slice(0, f.lastIndexOf("/")), f);
  }

  const routes = [];
  const problems = [];
  const seen = new Map();
  for (const page of inApp) {
    const slash = page.lastIndexOf("/");
    if (!PAGE_FILE_RE.test(page.slice(slash + 1))) continue;
    const dir = page.slice(0, slash);
    const segments = dir === APP_DIR ? [] : dir.slice(APP_DIR.length + 1).split("/");
    const urlSegments = segments.filter((seg) => !isGroupSegment(seg) && !isSlotSegment(seg));
    const slots = segments.filter(isSlotSegment);
    const url = `/${urlSegments.join("/")}`;
    const key = slots.length > 0 ? `${url} ${slots.join(",")}` : url;

    const layouts = [];
    for (let i = 0; i <= segments.length; i += 1) {
      const ancestor = i === 0 ? APP_DIR : `${APP_DIR}/${segments.slice(0, i).join("/")}`;
      const layout = layoutByDir.get(ancestor);
      if (layout) layouts.push(layout);
    }

    if (seen.has(key)) problems.push(`同じ URL のページが 2 つある: ${seen.get(key)} と ${page}(${key})`);
    else seen.set(key, page);
    routes.push({ page, dir, url, slots, key, layouts });
  }
  routes.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.page < b.page ? -1 : 1));
  return { routes, problems };
}

/**
 * src/app 配下のファイルを repo 相対パスで列挙する(src/app/api と . 始まりは降りない)。
 * `_` で始まるフォルダの中も返す(ルート内 loader `_screen/loader.ts` を地図が読むため。ページの発見からは discoverRoutes が外す)
 * @param {string} repoRoot
 */
export function listAppFiles(repoRoot) {
  const out = [];
  const walk = (rel) => {
    for (const entry of readdirSync(resolve(repoRoot, rel))) {
      if (entry.startsWith(".")) continue;
      const child = `${rel}/${entry}`;
      if (statSync(join(repoRoot, child)).isDirectory()) {
        if (NON_PAGE_AREAS.includes(child)) continue;
        walk(child);
      } else {
        out.push(child);
      }
    }
  };
  walk(APP_DIR);
  return out.sort();
}
