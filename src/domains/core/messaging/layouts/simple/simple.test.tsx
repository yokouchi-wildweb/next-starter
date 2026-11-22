// レイアウト「シンプル」の検査: 宣言(管理者が選べ、本文が必須)・件名はメールを送る時だけ必須(D211)・要約
// 実行: pnpm test src/domains/core/messaging/layouts/simple
import { test } from "node:test";
import assert from "node:assert/strict";

import { layoutValuesSchema } from "@/lib/messaging";

import { layout } from "./layout";

const values = { subject: "新しい機能のお知らせ", body: "いつもご利用ありがとうございます。\n新しい機能を追加しました。" };

test("宣言: シンプル、管理者が選べ、本文が必須でサムネイル・ボタンは任意", () => {
  assert.equal(layout.key, "simple");
  assert.equal(layout.adminSelectable, true);
  assert.equal(layoutValuesSchema(layout, { channels: ["email", "inApp"] }).safeParse(values).success, true);
  assert.equal(layoutValuesSchema(layout, { channels: ["email", "inApp"] }).safeParse({ subject: "s" }).success, false, "本文は必須");
});

test("要約: 題 = 件名 / 本文 = 本文 / 画像 = サムネイル / 行き先 = リンクのボタン", () => {
  assert.deepEqual(layout.summary({ ...values, image: "/a.png", link: { label: "見る", url: "/x" } }), {
    title: "新しい機能のお知らせ",
    body: values.body,
    image: "/a.png",
    link: { label: "見る", url: "/x" },
  });
});

test("件名(D211): メールを送らない時は任意・送る時は必須、無ければ要約の題は本文の頭(40 文字 + …)", () => {
  const { subject: _subject, ...withoutSubject } = values;
  assert.equal(layoutValuesSchema(layout, { channels: ["inApp"] }).safeParse(withoutSubject).success, true, "サービス内通知だけなら件名は任意");
  assert.equal(layoutValuesSchema(layout, { channels: ["inApp", "email"] }).safeParse(withoutSubject).success, false, "メールを送るなら件名が要る");
  assert.equal(layout.summary(values).title, values.subject, "件名があれば題は件名");
  assert.equal(layout.summary({ ...withoutSubject, body: `${"あ".repeat(45)}\n2 行目` }).title, `${"あ".repeat(40)}…`);
});
