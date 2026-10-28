// src/lib/crud/presenters/media.test.ts
//
// 一覧表示のサムネイル（formatCollectionThumbnails = 主の集まり、formatMediaThumbnails = 旧来の複数メディア列）のテスト。
// 実行: pnpm test:crud-presenters

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { formatCollectionThumbnails, formatMediaThumbnails } from "./media";

const url = (n: number) => `https://example.com/${n}.png`;
const urls = (count: number) => Array.from({ length: count }, (_, i) => url(i + 1));
const html = (node: unknown) => renderToStaticMarkup(node as React.ReactElement);
const imgCount = (markup: string) => markup.match(/<img /g)?.length ?? 0;

test("集まり: 0 件・配列でない値は null", () => {
  assert.equal(formatCollectionThumbnails([]), null);
  assert.equal(formatCollectionThumbnails(null), null);
  assert.equal(formatCollectionThumbnails(url(1)), null);
});

test("集まり: 1 件は先頭 1 枚だけ（+N なし）", () => {
  const markup = html(formatCollectionThumbnails(urls(1)));
  assert.equal(imgCount(markup), 1);
  assert.match(markup, /src="https:\/\/example\.com\/1\.png"/);
  assert.doesNotMatch(markup, /\+\d/);
});

test("集まり: 2 件・9 件は先頭 1 枚と残りの +N", () => {
  const two = html(formatCollectionThumbnails(urls(2)));
  assert.equal(imgCount(two), 1);
  assert.match(two, />\+1</);
  const nine = html(formatCollectionThumbnails(urls(9)));
  assert.equal(imgCount(nine), 1);
  assert.match(nine, /src="https:\/\/example\.com\/1\.png"/);
  assert.match(nine, />\+8</);
});

test("集まり: 解決できない値は描かず数えない（全部だめなら null）", () => {
  assert.equal(formatCollectionThumbnails(["", "not-a-url", 3, "storage://unknown/x"]), null);
  const markup = html(formatCollectionThumbnails(["bad", url(1), "", url(2)]));
  assert.equal(imgCount(markup), 1);
  assert.match(markup, /src="https:\/\/example\.com\/1\.png"/);
  assert.match(markup, />\+1</);
});

test("旧来の複数メディア列は今のまま（先頭 3 枚を重ねて、残りは +N）", () => {
  const markup = html(formatMediaThumbnails(urls(5)));
  assert.equal(imgCount(markup), 3);
  assert.match(markup, />\+2</);
});
