// AppImage の style と data-* の通しの検査(renderToStaticMarkup)。
// - どちらも渡さない時: fill・contain・intrinsic・fallback の出力が変更の前に記録した出力(__fixtures__/appImage.before.json)と同じ
// - style と data-* は一番外の要素(fill = 箱、intrinsic = img)に付き、data-component="AppImage" は渡しても変わらない
// 実行: pnpm test src/components/Media/AppImage
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { AppImage } from "./index";

const BEFORE = JSON.parse(
  readFileSync(new URL("./__fixtures__/appImage.before.json", import.meta.url), "utf8"),
) as Record<string, string>;

test("style / data-* なし: 出力が前と同じ", () => {
  assert.equal(
    renderToStaticMarkup(<AppImage src="/a.png" alt="A" sizes="100vw" className="aspect-square" />),
    BEFORE.fill,
  );
  assert.equal(
    renderToStaticMarkup(
      <AppImage src="/a.png" alt="A" sizes="50vw" objectFit="contain" imageClassName="object-top" priority />,
    ),
    BEFORE.contain,
  );
  assert.equal(
    renderToStaticMarkup(
      <AppImage mode="intrinsic" src="/logo.png" alt="L" width={160} height={40} className="h-9 w-auto" priority />,
    ),
    BEFORE.intrinsic,
  );
  assert.equal(
    renderToStaticMarkup(<AppImage src={null} alt="F" sizes="100vw" fallbackSrc="/f.png" />),
    BEFORE.fallback,
  );
});

test("fill: style と data-* は箱に付き、data-component は部品のまま", () => {
  const out = renderToStaticMarkup(
    <AppImage src="/a.png" alt="A" sizes="100vw" data-slot="hero-image" data-component="X" style={{ opacity: 0.5 }} />,
  );
  assert.match(
    out,
    /^<div data-slot="hero-image" data-component="AppImage" class="relative overflow-clip" style="opacity:0.5"><img /,
  );
  assert.doesNotMatch(out, /<img[^>]*data-slot/);
});

test("intrinsic: style と data-* は img に付き、next/image の style と合わさる", () => {
  const out = renderToStaticMarkup(
    <AppImage
      mode="intrinsic"
      src="/logo.png"
      alt="L"
      width={160}
      height={40}
      data-slot="header-brand-logo"
      style={{ transition: "opacity 0.3s" }}
    />,
  );
  assert.match(out, /<img[^>]*data-slot="header-brand-logo"[^>]*data-component="AppImage"/);
  assert.match(out, /style="[^"]*transition:opacity 0.3s/);
});
