// PreviewImage の出力の検査(renderToStaticMarkup): 素の img と同じ属性 + data-slot、既定の decoding="async"
// 実行: pnpm test src/components/Media/PreviewImage
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup as r } from "react-dom/server";

import { PreviewImage } from ".";

// React の SSR は loading の無い img の前に <link rel="preload"> を出す(素の img でも同じ)。ここでは img だけを比べる
const img = (html: string) => html.replace(/^<link [^>]*\/>/, "");

test("素の img を 1 つ描き、呼び手の属性をそのまま渡す", () => {
  const html = img(r(<PreviewImage src="blob:http://x/1" alt="下見" className="w-full max-h-80" style={{ opacity: 0 }} />));
  assert.equal(
    html,
    '<img data-slot="preview-image" src="blob:http://x/1" alt="下見" decoding="async" class="w-full max-h-80" style="opacity:0"/>',
  );
});

test("decoding は渡せば勝ち、loading は既定で付けない", () => {
  const html = r(<PreviewImage src="/a.png" alt="" decoding="sync" />);
  assert.match(html, /decoding="sync"/);
  assert.doesNotMatch(html, /loading=/);
});
