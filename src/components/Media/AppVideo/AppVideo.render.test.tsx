// AppVideo の出力の検査(renderToStaticMarkup)。
// - storage:// の ref は表示用 URL に直して video の src / poster に付く(非公開 = /api/storage/objects/<id>)
// - alt は aria-label と代わりの文、fit は object-* の class、controls は既定で付く、失敗の行は初めは出ない
// 実行: pnpm test src/components/Media/AppVideo
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { AppVideo } from "./index";

const VIDEO_ID = "01920000-0000-7000-8000-000000000001";
const POSTER_ID = "01920000-0000-7000-8000-000000000002";

test("URL はそのまま、alt・fit・controls が付き、失敗の行は無い", () => {
  const out = renderToStaticMarkup(<AppVideo src="/assets/a.mp4" alt="A" className="w-full" />);
  assert.match(out, /^<video [^>]*data-component="AppVideo"/);
  assert.match(out, /src="\/assets\/a.mp4"/);
  assert.match(out, /aria-label="A"/);
  assert.match(out, /class="object-contain w-full"/);
  assert.match(out, /controls=""/);
  assert.match(out, />A<\/video>$/);
  assert.doesNotMatch(out, /動画を読み込めませんでした/);
});

test("非公開の ref は固定 URL に直り、poster の ref も直る", () => {
  const out = renderToStaticMarkup(
    <AppVideo
      src={`storage://priv/chatRoom.video/${VIDEO_ID}.mp4`}
      poster={`storage://priv/chatRoom.image/${POSTER_ID}.jpg`}
      fit="cover"
      controls={false}
      muted
      loop
    />,
  );
  assert.match(out, new RegExp(`src="/api/storage/objects/${VIDEO_ID}"`));
  assert.match(out, new RegExp(`poster="/api/storage/objects/${POSTER_ID}"`));
  assert.match(out, /class="object-cover"/);
  assert.doesNotMatch(out, /controls=""/);
  assert.match(out, /loop=""/);
});

test("src が空なら src 属性なしで描く", () => {
  const out = renderToStaticMarkup(<AppVideo src={null} />);
  assert.doesNotMatch(out, / src=/);
});
