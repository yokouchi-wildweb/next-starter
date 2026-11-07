// src/features/core/userAcquisition/lib/classifyVisit.test.ts
//
// 流入の分類の動きを表で固定する: 同じ URL・リファラーから同じ source / medium / campaign / extras が出ること。
// UTM・クリック ID・招待・外部リファラーとその優先順位(UTM > クリック ID > 招待 > リファラー)、
// GA4 へ送る招待キャンペーンの判定、招待パラメータの読み書き。
// 実行: pnpm test src/features/core/userAcquisition/lib/classifyVisit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { appendInviteLinkParam, readInviteLinkParam } from "@/features/core/referral/lib/inviteLinkCookie";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { resolveLinkCampaign } from "@/lib/googleTag/googleTag";

import { classifyVisit, getChannelDefinitions } from "./classifyVisit";

const NOW = new Date("2026-11-07T00:00:00Z");
const T = Math.floor(NOW.getTime() / 1000);

type Case = {
  name: string;
  url: string;
  referrer?: string;
  expected: Record<string, unknown> | null;
};

const CASES: Case[] = [
  { name: "流入の印なし", url: "https://example.com/lp", expected: null },
  { name: "自ホストからの遷移はリファラーにしない", url: "https://example.com/lp", referrer: "https://example.com/a", expected: null },
  { name: "不正なリファラーは無視", url: "https://example.com/lp", referrer: "not a url", expected: null },
  {
    name: "UTM 3 つ + term / content",
    url: "https://example.com/lp?utm_source=news&utm_medium=email&utm_campaign=fall&utm_term=t&utm_content=c",
    expected: { t: T, s: "news", m: "email", c: "fall", l: "/lp", x: { utm_term: "t", utm_content: "c" } },
  },
  {
    name: "UTM は medium だけ",
    url: "https://example.com/lp?utm_medium=email",
    expected: { t: T, m: "email", l: "/lp" },
  },
  {
    name: "クリック ID gclid",
    url: "https://example.com/lp?gclid=abc",
    expected: { t: T, s: "google", m: "cpc", l: "/lp", x: { gclid: "abc" } },
  },
  {
    name: "クリック ID fbclid + 外部リファラー(クリック ID が優先、r は残る)",
    url: "https://example.com/lp?fbclid=f1",
    referrer: "https://m.facebook.com/x",
    expected: { t: T, s: "facebook", m: "paid-social", r: "m.facebook.com", l: "/lp", x: { fbclid: "f1" } },
  },
  {
    name: "クリック ID 2 つは表の先の行が source を決め、両方 extras に入る",
    url: "https://example.com/lp?ttclid=t1&gclid=g1",
    expected: { t: T, s: "google", m: "cpc", l: "/lp", x: { gclid: "g1", ttclid: "t1" } },
  },
  {
    name: "UTM source + クリック ID(UTM が優先、medium はクリック ID で補わない)",
    url: "https://example.com/lp?utm_source=news&gclid=g1",
    expected: { t: T, s: "news", l: "/lp", x: { gclid: "g1" } },
  },
  {
    name: "UTM medium だけ + クリック ID(source をクリック ID で補い、medium は UTM)",
    url: "https://example.com/lp?utm_medium=email&gclid=g1",
    expected: { t: T, s: "google", m: "email", l: "/lp", x: { gclid: "g1" } },
  },
  {
    name: "招待だけ",
    url: "https://example.com/lp?invite=ABC123",
    expected: { t: T, s: "invite", m: "invite", l: "/lp", x: { invite: "ABC123" } },
  },
  {
    name: "招待 + 外部リファラー(招待が優先)",
    url: "https://example.com/lp?invite=ABC123",
    referrer: "https://t.co/xyz",
    expected: { t: T, s: "invite", m: "invite", r: "t.co", l: "/lp", x: { invite: "ABC123" } },
  },
  {
    name: "招待 + クリック ID(クリック ID が優先)",
    url: "https://example.com/lp?invite=ABC123&yclid=y1",
    expected: { t: T, s: "yahoo", m: "cpc", l: "/lp", x: { yclid: "y1", invite: "ABC123" } },
  },
  {
    name: "招待 + UTM(UTM が優先)",
    url: "https://example.com/lp?invite=ABC123&utm_source=x&utm_campaign=c1",
    expected: { t: T, s: "x", c: "c1", l: "/lp", x: { invite: "ABC123" } },
  },
  {
    name: "外部リファラーだけ",
    url: "https://example.com/lp",
    referrer: "https://www.google.com/search?q=a",
    expected: { t: T, s: "www.google.com", m: "referral", r: "www.google.com", l: "/lp" },
  },
  {
    name: "空白だけの値は無い扱い",
    url: "https://example.com/lp?utm_source=%20&invite=%20",
    expected: null,
  },
  {
    name: "値は前後の空白を落として 200 文字に切る",
    url: `https://example.com/lp?utm_source=${"a".repeat(250)}%20`,
    expected: { t: T, s: "a".repeat(200), l: "/lp" },
  },
];

test("流入の分類は表のとおり", () => {
  for (const c of CASES) {
    const actual = classifyVisit({ url: new URL(c.url), referrer: c.referrer ?? null, now: NOW });
    assert.deepEqual(actual, c.expected, c.name);
  }
});

test("GA4 の招待キャンペーン: 招待だけのときに invite / invite", () => {
  const definitions = getChannelDefinitions();
  assert.deepEqual(resolveLinkCampaign("?invite=ABC", definitions), {
    campaign_source: "invite",
    campaign_medium: "invite",
  });
  assert.equal(resolveLinkCampaign("", definitions), null);
  assert.equal(resolveLinkCampaign("?invite=%20", definitions), null);
  assert.equal(resolveLinkCampaign("?invite=ABC&utm_source=x", definitions), null);
  assert.equal(resolveLinkCampaign("?invite=ABC&utm_medium=x", definitions), null);
  assert.equal(resolveLinkCampaign("?invite=ABC&utm_campaign=x", definitions), null);
  for (const clickId of ["gclid", "wbraid", "gbraid", "fbclid", "ttclid", "msclkid", "yclid", "twclid", "ldtag_cl"]) {
    assert.equal(resolveLinkCampaign(`?invite=ABC&${clickId}=1`, definitions), null, clickId);
  }
  // 判別表を受け取らなければ何も足さない(lib は自分で定義を持たない)
  assert.equal(resolveLinkCampaign("?invite=ABC", []), null);
});

test("判別表: クリック ID 9 行と招待 1 行", () => {
  const definitions = getChannelDefinitions();
  assert.deepEqual(
    definitions.map((d) => [d.param, d.kind, d.channel]),
    [
      ["gclid", "clickId", { source: "google", medium: "cpc" }],
      ["wbraid", "clickId", { source: "google", medium: "cpc" }],
      ["gbraid", "clickId", { source: "google", medium: "cpc" }],
      ["fbclid", "clickId", { source: "facebook", medium: "paid-social" }],
      ["ttclid", "clickId", { source: "tiktok", medium: "paid-social" }],
      ["msclkid", "clickId", { source: "bing", medium: "cpc" }],
      ["yclid", "clickId", { source: "yahoo", medium: "cpc" }],
      ["twclid", "clickId", { source: "twitter", medium: "paid-social" }],
      ["ldtag_cl", "clickId", { source: "line", medium: "paid-social" }],
      ["invite", "link", { source: "invite", medium: "invite" }],
    ],
  );
});

test("招待パラメータの読み書き(referral の名前 invite)", () => {
  assert.equal(readInviteLinkParam(new URL("https://example.com/?invite=%20ABC%20")), "ABC");
  assert.equal(readInviteLinkParam(new URL("https://example.com/?invite=")), null);
  assert.equal(readInviteLinkParam(new URL("https://example.com/")), null);
  assert.equal(readInviteLinkParam(new URL(`https://example.com/?invite=${"b".repeat(250)}`)), "b".repeat(200));
  assert.equal(appendInviteLinkParam("https://example.com/v", "A B"), "https://example.com/v?invite=A%20B");
  assert.equal(appendInviteLinkParam("https://example.com/v?x=1", "C"), "https://example.com/v?x=1&invite=C");
});

test("紹介の機能が閉じている間は招待の行を出さず、invite は流入の印にならない", () => {
  const referral = APP_FEATURES.marketing.referral as { enabled: boolean };
  const saved = referral.enabled;
  referral.enabled = false;
  try {
    const definitions = getChannelDefinitions();
    assert.equal(definitions.some((d) => d.param === "invite"), false);
    assert.equal(definitions.length, 9);
    assert.equal(classifyVisit({ url: new URL("https://example.com/lp?invite=ABC"), referrer: null, now: NOW }), null);
    assert.equal(resolveLinkCampaign("?invite=ABC", definitions), null);
  } finally {
    referral.enabled = saved;
  }
  assert.equal(getChannelDefinitions().some((d) => d.param === "invite"), true);
});
