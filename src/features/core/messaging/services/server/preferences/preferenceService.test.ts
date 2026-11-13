// 好みの service の検査(DB は偽物)
// - 形 = 経路(enabled: false の経路は出ない)> 種別の枠 > グループ(無い種類が先)> 種類。マスの止まり方は送る側の checkStops と同じ(kind の行も)
// - 宛先の有無: 経路の自前の引き方 / 無ければ端末の帳簿。connectHref は門で閉じた住所なら null
// - 1 マス・全体('*' '*')・種別まるごと(kind)を止める(source 既定 user、呼び手の値)/ 再開する(その行だけ消す。広い行は via で残る)
// - 種別まるごとの行がある人が 1 マスを再開すると書き分ける(D71)
// - 知らない種類・有効でない経路・片方だけの '*'・止められない種別は 400、受け口の誤りは投げる
// 実行: pnpm test src/features/core/messaging/services/server/preferences
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { MessageCategory, MessageCategoryGroup, MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { checkStops } from "../sendMessage/stops";
import type { MessageSendDeps } from "../sendMessage/types";
import { createPreferenceService, preferenceVia } from "./preferenceService";
import type { MessagePreferenceRow } from "./types";

const USER = "11111111-1111-4111-8111-111111111111";

function channel(key: string, extra: Partial<MessageChannel> = {}): MessageChannel {
  return { key, label: key.toUpperCase(), addressing: "user", fields: z.object({}), send: async () => [], ...extra };
}

const categories: Record<string, MessageCategory> = {
  marketing: { key: "marketing", label: "キャンペーン情報", kind: "marketing", channels: ["email", "inApp", "push", "sms", "line"] },
  activity: { key: "activity", label: "アクティビティ", description: "反応の通知", kind: "activity", channels: ["email", "inApp"] },
  // 利用者が止められない種別の種類は好みの表に出ない
  registrationComplete: { key: "registrationComplete", label: "会員登録の完了", kind: "transactional", channels: ["email"] },
  campaign: { key: "campaign", label: "セール", kind: "marketing", channels: ["email", "inApp"], group: "promo" },
};
const groups: Record<string, MessageCategoryGroup> = { promo: { key: "promo", label: "販促", order: 1 } };

type StoredRow = MessagePreferenceRow & { source?: string };

function setup(options: { rows?: MessagePreferenceRow[]; email?: boolean; openHrefs?: string[]; categories?: Record<string, MessageCategory> } = {}) {
  const rows: StoredRow[] = [...(options.rows ?? [])];
  const writes: { remove: number; add: number }[] = [];
  const channels: Record<string, MessageChannel> = {
    email: channel("email", {
      resolveAddresses: async (ids) => (options.email === false ? [] : ids.map((userId) => ({ userId, address: "a@x.test" }))),
    }),
    inApp: channel("inApp", { resolveAddresses: async (ids) => ids.map((userId) => ({ userId, address: userId })) }),
    line: channel("line", { enabled: false, connectHref: "/api/auth/line/login" }),
    push: channel("push", { connectHref: "/mypage/push?x=1" }),
    sms: channel("sms", { connectHref: "/mypage/sms" }),
  };
  const same = (row: MessagePreferenceRow, key: { category: string; channel: string; kind?: string | null }) =>
    row.category === key.category && row.channel === key.channel && (row.kind ?? null) === (key.kind ?? null);
  const service = createPreferenceService({
    store: {
      listOwn: async (userId) => (userId === USER ? rows.map(({ category, channel: ch, kind }) => ({ category, channel: ch, kind: kind ?? null })) : []),
      write: async (_userId, { remove = [], add = [] }) => {
        writes.push({ remove: remove.length, add: add.length });
        for (const key of remove) {
          const index = rows.findIndex((row) => same(row, key));
          if (index >= 0) rows.splice(index, 1);
        }
        for (const row of add) {
          if (!rows.some((existing) => same(existing, row))) rows.push({ category: row.category, channel: row.channel, kind: row.kind ?? null, source: row.source });
        }
      },
      deleteAllOfUser: async () => {},
    },
    categories: options.categories ?? categories,
    groups,
    channels,
    findLedgerEndpoints: async (ch, ids) => (ch === "push" ? ids.map((userId) => ({ userId, address: "tok" })) : []),
    isHrefOpen: (href) => (options.openHrefs ?? []).includes(href),
  });
  return { service, rows, writes };
}

const row = (category: string, ch: string, kind: string | null = null): MessagePreferenceRow => ({ category, channel: ch, kind });
type Dto = Awaited<ReturnType<ReturnType<typeof setup>["service"]["getPreferences"]>>;
/** 経路 → 種類 → [optedOut, via] */
function cellsOf(dto: Dto) {
  const out: Record<string, Record<string, [boolean, string | null]>> = {};
  for (const ch of dto.channels) {
    out[ch.key] = {};
    for (const frame of ch.kinds) for (const group of frame.groups) for (const c of group.categories) out[ch.key][c.key] = [c.optedOut, c.via];
  }
  return out;
}

test("形: 経路 > 種別の枠 > グループ(無い種類が先)> 種類、宛先の有無と connectHref", async () => {
  const { service } = setup({ email: false, openHrefs: ["/mypage/push?x=1"] });
  const dto = await service.getPreferences(USER);
  assert.equal(dto.allOptedOut, false);
  assert.deepEqual(dto.kinds, [{ kind: "activity", optedOut: false }, { kind: "marketing", optedOut: false }]);
  assert.deepEqual(
    dto.channels.map(({ key, label, hasAddress, connectHref }) => ({ key, label, hasAddress, connectHref })),
    [
      { key: "email", label: "EMAIL", hasAddress: false, connectHref: null },
      { key: "inApp", label: "INAPP", hasAddress: true, connectHref: null },
      { key: "push", label: "PUSH", hasAddress: true, connectHref: "/mypage/push?x=1" },
      { key: "sms", label: "SMS", hasAddress: false, connectHref: null },
    ],
  );
  const email = dto.channels[0];
  assert.deepEqual(email.kinds.map((frame) => frame.kind), ["activity", "marketing"]);
  assert.deepEqual(email.kinds[1].groups.map((g) => [g.key, g.label, g.categories.map((c) => c.key)]), [
    [null, null, ["marketing"]],
    ["promo", "販促", ["campaign"]],
  ]);
  assert.deepEqual(email.kinds[0].groups[0].categories[0], {
    key: "activity",
    label: "アクティビティ",
    description: "反応の通知",
    optedOut: false,
    via: null,
  });
  // 列 = 開いている経路 ∩ 種類の経路(push には marketing だけ、取引の種類は出ない)
  assert.deepEqual(dto.channels[2].kinds.map((f) => [f.kind, f.groups.flatMap((g) => g.categories.map((c) => c.key))]), [["marketing", ["marketing"]]]);
});

test("1 マスを止めて再開する(source user)、全体の行は allOptedOut と via all", async () => {
  const { service, rows } = setup();
  let dto = await service.setPreference(USER, { category: "marketing", channel: "email", optedOut: true });
  assert.deepEqual(rows, [{ category: "marketing", channel: "email", kind: null, source: "user" }]);
  assert.deepEqual(cellsOf(dto).email.marketing, [true, "cell"]);
  assert.deepEqual(cellsOf(dto).inApp.marketing, [false, null]);
  dto = await service.setPreference(USER, { category: "marketing", channel: "email", optedOut: false });
  assert.equal(rows.length, 0);
  assert.deepEqual(cellsOf(dto).email.marketing, [false, null]);

  dto = await service.setPreference(USER, { category: "*", channel: "*", optedOut: true });
  assert.equal(dto.allOptedOut, true);
  assert.ok(Object.values(cellsOf(dto)).every((cells) => Object.values(cells).every(([o, via]) => o && via === "all")));
  dto = await service.setPreference(USER, { category: "*", channel: "*", optedOut: false });
  assert.equal(dto.allOptedOut, false);
});

test("source は呼び手の値(既定 user)", async () => {
  const { service, rows } = setup();
  await service.setPreference(USER, { kind: "marketing", optedOut: true }, { source: "signup" });
  await service.setPreference(USER, { category: "activity", channel: "email", optedOut: true });
  assert.deepEqual(rows.map((r) => [r.category, r.channel, r.kind, r.source]), [
    ["*", "*", "marketing", "signup"],
    ["activity", "email", null, "user"],
  ]);
});

test("マスの再開はそのマスの行だけを消す。広い行で止まるマスは via で残る", async () => {
  const { service, rows } = setup({ rows: [row("activity", "*"), row("activity", "email")] });
  const dto = await service.setPreference(USER, { category: "activity", channel: "email", optedOut: false });
  assert.deepEqual(rows, [row("activity", "*")]);
  assert.deepEqual(cellsOf(dto).email.activity, [true, "category"]);
});

test("種別まるごと: 止めると種別の種類が全部 via kind、ほかの種別と全体は変わらない。再開で行を消す", async () => {
  const { service, rows } = setup();
  let dto = await service.setPreference(USER, { kind: "marketing", optedOut: true });
  assert.deepEqual(rows, [{ category: "*", channel: "*", kind: "marketing", source: "user" }]);
  assert.deepEqual(dto.kinds, [{ kind: "activity", optedOut: false }, { kind: "marketing", optedOut: true }]);
  assert.equal(dto.allOptedOut, false);
  const cells = cellsOf(dto);
  assert.deepEqual([cells.email.marketing, cells.inApp.campaign, cells.push.marketing], [[true, "kind"], [true, "kind"], [true, "kind"]]);
  assert.deepEqual(cells.email.activity, [false, null]);
  dto = await service.setPreference(USER, { kind: "marketing", optedOut: false });
  assert.equal(rows.length, 0);
  assert.equal(dto.kinds[1].optedOut, false);
});

test("種別まるごとの行がある人が 1 マスを再開すると、1 回の書き込みで種別の行を書き分ける(D71)", async () => {
  const { service, rows, writes } = setup({ rows: [row("*", "*", "marketing")] });
  writes.length = 0;
  const dto = await service.setPreference(USER, { category: "marketing", channel: "email", optedOut: false });
  assert.deepEqual(writes, [{ remove: 2, add: 5 }]);
  assert.deepEqual(
    rows.map((r) => [r.category, r.channel, r.kind]).sort(),
    [
      ["campaign", "*", null],
      ["marketing", "inApp", null],
      ["marketing", "line", null],
      ["marketing", "push", null],
      ["marketing", "sms", null],
    ],
  );
  const cells = cellsOf(dto);
  assert.deepEqual(cells.email.marketing, [false, null]);
  assert.deepEqual(cells.inApp.marketing, [true, "cell"]);
  assert.deepEqual(cells.email.campaign, [true, "category"]);
  assert.equal(dto.kinds[1].optedOut, false);
  // 種別の行が無ければ書き分けない
  writes.length = 0;
  await service.setPreference(USER, { category: "marketing", channel: "inApp", optedOut: false });
  assert.deepEqual(writes, [{ remove: 1, add: 0 }]);
});

test("入力の誤り・知らない種類・有効でない経路・止められない種別は 400", async () => {
  const { service } = setup();
  for (const input of [
    null,
    { category: "marketing", channel: "email" },
    { category: "*", channel: "email", optedOut: true },
    { category: "nope", channel: "email", optedOut: true },
    { category: "registrationComplete", channel: "email", optedOut: true },
    { category: "marketing", channel: "line", optedOut: true },
    { category: "marketing", channel: "email", optedOut: true, userId: "other" },
    { kind: "transactional", optedOut: true },
    { kind: "nope", optedOut: true },
    { kind: "marketing", optedOut: true, category: "marketing" },
  ]) {
    await assert.rejects(service.setPreference(USER, input), (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.status, 400);
      return true;
    });
  }
  await assert.rejects(service.setPreference(USER, { kind: "marketing", optedOut: true }, { source: "" }), DomainError);
});

test("種類とグループの受け口の誤り(知らないグループ)は投げる", async () => {
  const { service } = setup({ categories: { ...categories, bad: { key: "bad", label: "x", kind: "activity", channels: ["email"], group: "nope" } } });
  await assert.rejects(service.getPreferences(USER), /group nope/);
});

test("マスの止まり方は送る側(checkStops)の判定と同じ(kind の行を含む)", async () => {
  const rowSets: MessagePreferenceRow[][] = [
    [],
    [row("marketing", "email")],
    [row("marketing", "*")],
    [row("*", "inApp")],
    [row("*", "*")],
    [row("activity", "email"), row("*", "push")],
    [row("*", "*", "marketing")],
    [row("*", "*", "activity"), row("marketing", "inApp")],
  ];
  const kindOf: Record<string, string> = { marketing: "marketing", activity: "activity" };
  for (const rows of rowSets) {
    // 送る側の store.findOptOuts と同じ絞り込み(種類 = その種類か '*'、経路 = 送る経路か '*'、kind = null か連絡の種別)
    const deps = {
      store: {
        findOptOuts: async (userIds: readonly string[], category: string, kind: string | null, chs: readonly string[]) =>
          rows
            .filter(
              (r) =>
                (r.category === category || r.category === "*") &&
                [...chs, "*"].includes(r.channel) &&
                (r.kind === null || r.kind === kind),
            )
            .flatMap((r) => userIds.map((userId) => ({ userId, channel: r.channel }))),
        findSuppressions: async () => [],
      },
    } as unknown as MessageSendDeps;
    for (const category of ["marketing", "activity"]) {
      for (const ch of ["email", "inApp", "push"]) {
        const [verdict] = await checkStops(deps, { kind: kindOf[category] as "marketing", required: false, category }, [
          { recipientKey: `user:${USER}`, userId: USER, channel: ch, addresses: ["x"] },
        ]);
        assert.equal(preferenceVia(rows, category, ch, kindOf[category]) !== null, verdict.stopped, JSON.stringify({ rows, category, ch }));
      }
    }
  }
});

test("API の住所の定数は門 messagingPreferences の pathPatterns にある(ページの住所はページと一緒に足す)", async () => {
  const { rule } = await import("@/featureGate/rules/messagingPreferences");
  const { MESSAGE_PREFERENCES_API_PATH } = await import("../../../constants/preferences");
  assert.ok(rule.pathPatterns?.includes(MESSAGE_PREFERENCES_API_PATH));
  assert.equal(rule.defaultEnabled, false);
});
