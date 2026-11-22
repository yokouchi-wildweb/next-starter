// 好みの service の検査(DB は偽物)
// - 形 = 送信チャンネル(enabled: false の送信チャンネルは出ない)> 種別の枠 > グループ(無いカテゴリーが先)> カテゴリー。マスの止まり方は送る側の checkStops と同じ(kind の行も)
// - 宛先の有無: 送信チャンネルの自前の引き方 / 無ければ端末の帳簿。connectHref は門で閉じた住所なら null
// - 1 マス・カテゴリーまるごと・送信チャンネルまるごと・全体('*' '*')・種別まるごと(kind)を止める(source 既定 user、呼び手の値)/ 再開する(その行だけ消す)
// - 広い行(種別・カテゴリー・送信チャンネルまるごと)の下で 1 マスを再開すると書き分ける(D71・指令 37)。全体の行は書き分けず via all で残る
// - 知らないカテゴリー・有効でない送信チャンネル・片方だけの '*'・止められない種別は 400、受け口の誤りは投げる
// 実行: pnpm test src/domains/core/messaging/services/server/preferences
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
  return { key, label: key.toUpperCase(), addressing: "user", send: async () => [], ...extra };
}

const categories: Record<string, MessageCategory> = {
  promotion: { key: "promotion", label: "キャンペーン情報", kind: "promotion", channels: ["email", "inApp", "push", "sms", "line"] },
  activity: { key: "activity", label: "アクティビティ", description: "反応の通知", kind: "activity", channels: ["email", "inApp"] },
  // 利用者が止められない種別のカテゴリーは好みの表に出ない
  registrationComplete: { key: "registrationComplete", label: "会員登録の完了", kind: "transactional", channels: ["email"] },
  campaign: { key: "campaign", label: "セール", kind: "promotion", channels: ["email", "inApp"], group: "promo" },
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
/** 送信チャンネル → カテゴリー → [optedOut, via] */
function cellsOf(dto: Dto) {
  const out: Record<string, Record<string, [boolean, string | null]>> = {};
  for (const ch of dto.channels) {
    out[ch.key] = {};
    for (const frame of ch.kinds) for (const group of frame.groups) for (const c of group.categories) out[ch.key][c.key] = [c.optedOut, c.via];
  }
  return out;
}

test("形: 送信チャンネル > 種別の枠 > グループ(無いカテゴリーが先)> カテゴリー、宛先の有無と connectHref", async () => {
  const { service } = setup({ email: false, openHrefs: ["/mypage/push?x=1"] });
  const dto = await service.getPreferences(USER);
  assert.equal(dto.allOptedOut, false);
  assert.deepEqual(dto.kinds, [{ kind: "activity", optedOut: false }, { kind: "promotion", optedOut: false }]);
  assert.deepEqual(dto.categories, [
    { key: "promotion", optedOut: false },
    { key: "activity", optedOut: false },
    { key: "campaign", optedOut: false },
  ]);
  assert.ok(dto.channels.every((ch) => ch.optedOut === false));
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
  assert.deepEqual(email.kinds.map((frame) => frame.kind), ["activity", "promotion"]);
  assert.deepEqual(email.kinds[1].groups.map((g) => [g.key, g.label, g.categories.map((c) => c.key)]), [
    [null, null, ["promotion"]],
    ["promo", "販促", ["campaign"]],
  ]);
  assert.deepEqual(email.kinds[0].groups[0].categories[0], {
    key: "activity",
    label: "アクティビティ",
    description: "反応の通知",
    optedOut: false,
    via: null,
  });
  // 列 = 開いている送信チャンネル ∩ カテゴリーの送信チャンネル(push には promotion だけ、取引のカテゴリーは出ない)
  assert.deepEqual(dto.channels[2].kinds.map((f) => [f.kind, f.groups.flatMap((g) => g.categories.map((c) => c.key))]), [["promotion", ["promotion"]]]);
});

test("1 マスを止めて再開する(source user)、全体の行は allOptedOut と via all", async () => {
  const { service, rows } = setup();
  let dto = await service.setPreference(USER, { category: "promotion", channel: "email", optedOut: true });
  assert.deepEqual(rows, [{ category: "promotion", channel: "email", kind: null, source: "user" }]);
  assert.deepEqual(cellsOf(dto).email.promotion, [true, "cell"]);
  assert.deepEqual(cellsOf(dto).inApp.promotion, [false, null]);
  dto = await service.setPreference(USER, { category: "promotion", channel: "email", optedOut: false });
  assert.equal(rows.length, 0);
  assert.deepEqual(cellsOf(dto).email.promotion, [false, null]);

  dto = await service.setPreference(USER, { category: "*", channel: "*", optedOut: true });
  assert.equal(dto.allOptedOut, true);
  assert.ok(Object.values(cellsOf(dto)).every((cells) => Object.values(cells).every(([o, via]) => o && via === "all")));
  dto = await service.setPreference(USER, { category: "*", channel: "*", optedOut: false });
  assert.equal(dto.allOptedOut, false);
});

test("source は呼び手の値(既定 user)", async () => {
  const { service, rows } = setup();
  await service.setPreference(USER, { kind: "promotion", optedOut: true }, { source: "signup" });
  await service.setPreference(USER, { category: "activity", channel: "email", optedOut: true });
  assert.deepEqual(rows.map((r) => [r.category, r.channel, r.kind, r.source]), [
    ["*", "*", "promotion", "signup"],
    ["activity", "email", null, "user"],
  ]);
});

test("カテゴリーまるごと・送信チャンネルまるごとを止めて再開する(その行だけ)。状態は categories と channels[].optedOut", async () => {
  const { service, rows } = setup();
  let dto = await service.setPreference(USER, { category: "activity", channel: "*", optedOut: true });
  assert.deepEqual(rows, [{ category: "activity", channel: "*", kind: null, source: "user" }]);
  assert.deepEqual(dto.categories.find((c) => c.key === "activity"), { key: "activity", optedOut: true });
  assert.deepEqual([cellsOf(dto).email.activity, cellsOf(dto).inApp.activity], [[true, "category"], [true, "category"]]);
  dto = await service.setPreference(USER, { category: "*", channel: "push", optedOut: true }, { source: "signup" });
  assert.equal(dto.channels.find((c) => c.key === "push")?.optedOut, true);
  assert.deepEqual(cellsOf(dto).push.promotion, [true, "channel"]);
  assert.equal(rows[1].source, "signup");
  dto = await service.setPreference(USER, { category: "activity", channel: "*", optedOut: false });
  dto = await service.setPreference(USER, { category: "*", channel: "push", optedOut: false });
  assert.equal(rows.length, 0);
  assert.ok(dto.categories.every((c) => !c.optedOut) && dto.channels.every((c) => !c.optedOut));
});

test("カテゴリーまるごとの下の 1 マスの再開: カテゴリーの行を消し、そのカテゴリーのほかの送信チャンネルをマスで止める", async () => {
  const { service, rows, writes } = setup({ rows: [row("activity", "*"), row("activity", "email")] });
  writes.length = 0;
  const dto = await service.setPreference(USER, { category: "activity", channel: "email", optedOut: false });
  assert.deepEqual(writes, [{ remove: 2, add: 1 }]);
  assert.deepEqual(rows.map((r) => [r.category, r.channel]), [["activity", "inApp"]]);
  assert.deepEqual(cellsOf(dto).email.activity, [false, null]);
  assert.deepEqual(cellsOf(dto).inApp.activity, [true, "cell"]);
  assert.equal(dto.categories.find((c) => c.key === "activity")?.optedOut, false);
});

test("送信チャンネルまるごとの下の 1 マスの再開: 送信チャンネルの行を消し、その送信チャンネルを持つほかのカテゴリーをマスで止める", async () => {
  const { service, rows } = setup({ rows: [row("*", "inApp")] });
  const dto = await service.setPreference(USER, { category: "promotion", channel: "inApp", optedOut: false });
  assert.deepEqual(rows.map((r) => [r.category, r.channel]).sort(), [["activity", "inApp"], ["campaign", "inApp"]]);
  assert.deepEqual(cellsOf(dto).inApp.promotion, [false, null]);
  assert.deepEqual(cellsOf(dto).inApp.campaign, [true, "cell"]);
  assert.equal(dto.channels.find((c) => c.key === "inApp")?.optedOut, false);
});

test("広い行が重なる時は全部を書き分け(和)、全体の行は書き分けず via all で残る", async () => {
  const { service, rows, writes } = setup({ rows: [row("promotion", "*"), row("*", "email"), row("*", "*", "promotion")] });
  writes.length = 0;
  let dto = await service.setPreference(USER, { category: "promotion", channel: "email", optedOut: false });
  assert.deepEqual(writes, [{ remove: 4, add: 7 }]);
  assert.deepEqual(
    rows.map((r) => [r.category, r.channel, r.kind]).sort(),
    [
      ["activity", "email", null],
      ["campaign", "*", null],
      ["campaign", "email", null],
      ["promotion", "inApp", null],
      ["promotion", "line", null],
      ["promotion", "push", null],
      ["promotion", "sms", null],
    ].sort(),
  );
  assert.deepEqual(cellsOf(dto).email.promotion, [false, null]);
  const allRows = setup({ rows: [row("*", "*")] });
  dto = await allRows.service.setPreference(USER, { category: "promotion", channel: "email", optedOut: false });
  assert.deepEqual(allRows.rows, [row("*", "*")]);
  assert.deepEqual(cellsOf(dto).email.promotion, [true, "all"]);
});

test("種別まるごと: 止めると種別のカテゴリーが全部 via kind、ほかの種別と全体は変わらない。再開で行を消す", async () => {
  const { service, rows } = setup();
  let dto = await service.setPreference(USER, { kind: "promotion", optedOut: true });
  assert.deepEqual(rows, [{ category: "*", channel: "*", kind: "promotion", source: "user" }]);
  assert.deepEqual(dto.kinds, [{ kind: "activity", optedOut: false }, { kind: "promotion", optedOut: true }]);
  assert.equal(dto.allOptedOut, false);
  const cells = cellsOf(dto);
  assert.deepEqual([cells.email.promotion, cells.inApp.campaign, cells.push.promotion], [[true, "kind"], [true, "kind"], [true, "kind"]]);
  assert.deepEqual(cells.email.activity, [false, null]);
  dto = await service.setPreference(USER, { kind: "promotion", optedOut: false });
  assert.equal(rows.length, 0);
  assert.equal(dto.kinds[1].optedOut, false);
});

test("種別まるごとの行がある人が 1 マスを再開すると、1 回の書き込みで種別の行を書き分ける(D71)", async () => {
  const { service, rows, writes } = setup({ rows: [row("*", "*", "promotion")] });
  writes.length = 0;
  const dto = await service.setPreference(USER, { category: "promotion", channel: "email", optedOut: false });
  assert.deepEqual(writes, [{ remove: 2, add: 5 }]);
  assert.deepEqual(
    rows.map((r) => [r.category, r.channel, r.kind]).sort(),
    [
      ["campaign", "*", null],
      ["promotion", "inApp", null],
      ["promotion", "line", null],
      ["promotion", "push", null],
      ["promotion", "sms", null],
    ],
  );
  const cells = cellsOf(dto);
  assert.deepEqual(cells.email.promotion, [false, null]);
  assert.deepEqual(cells.inApp.promotion, [true, "cell"]);
  assert.deepEqual(cells.email.campaign, [true, "category"]);
  assert.equal(dto.kinds[1].optedOut, false);
  // 種別の行が無ければ書き分けない
  writes.length = 0;
  await service.setPreference(USER, { category: "promotion", channel: "inApp", optedOut: false });
  assert.deepEqual(writes, [{ remove: 1, add: 0 }]);
});

test("入力の誤り・知らないカテゴリー・有効でない送信チャンネル・止められない種別は 400", async () => {
  const { service } = setup();
  for (const input of [
    null,
    { category: "promotion", channel: "email" },
    { category: "*", channel: "line", optedOut: true },
    { category: "nope", channel: "*", optedOut: true },
    { category: "registrationComplete", channel: "*", optedOut: true },
    { category: "nope", channel: "email", optedOut: true },
    { category: "registrationComplete", channel: "email", optedOut: true },
    { category: "promotion", channel: "line", optedOut: true },
    { category: "promotion", channel: "email", optedOut: true, userId: "other" },
    { kind: "transactional", optedOut: true },
    { kind: "nope", optedOut: true },
    { kind: "promotion", optedOut: true, category: "promotion" },
  ]) {
    await assert.rejects(service.setPreference(USER, input), (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.status, 400);
      return true;
    });
  }
  await assert.rejects(service.setPreference(USER, { kind: "promotion", optedOut: true }, { source: "" }), DomainError);
});

test("カテゴリーとグループの受け口の誤り(知らないグループ)は投げる", async () => {
  const { service } = setup({ categories: { ...categories, bad: { key: "bad", label: "x", kind: "activity", channels: ["email"], group: "nope" } } });
  await assert.rejects(service.getPreferences(USER), /group nope/);
});

test("マスの止まり方は送る側(checkStops)の判定と同じ(kind の行・グループの行を含む)", async () => {
  const rowSets: MessagePreferenceRow[][] = [
    [],
    [row("promotion", "email")],
    [row("promotion", "*")],
    [row("*", "inApp")],
    [row("*", "*")],
    [row("activity", "email"), row("*", "push")],
    [row("*", "*", "promotion")],
    [row("*", "*", "activity"), row("promotion", "inApp")],
    [row("group:promo", "inApp")],
    [row("group:promo", "*"), row("activity", "push")],
  ];
  const kindOf: Record<string, string> = { promotion: "promotion", activity: "activity", campaign: "promotion" };
  for (const rows of rowSets) {
    // 送る側の store.findOptOuts と同じ絞り込み(カテゴリー = そのカテゴリーか '*' か入っているグループの行、送信チャンネル = 送る送信チャンネルか '*'、kind = null か連絡の種別)
    const deps = {
      categories,
      store: {
        findOptOuts: async (userIds: readonly string[], category: string, kind: string | null, chs: readonly string[], groupRow?: string | null) =>
          rows
            .filter(
              (r) =>
                (r.category === category || r.category === "*" || (Boolean(groupRow) && r.category === groupRow)) &&
                [...chs, "*"].includes(r.channel) &&
                (r.kind === null || r.kind === kind),
            )
            .flatMap((r) => userIds.map((userId) => ({ userId, channel: r.channel }))),
        findSuppressions: async () => [],
      },
    } as unknown as MessageSendDeps;
    for (const category of ["promotion", "activity", "campaign"]) {
      for (const ch of ["email", "inApp", "push"]) {
        const [verdict] = await checkStops(deps, { kind: kindOf[category] as "promotion", required: false, category }, [
          { recipientKey: `user:${USER}`, userId: USER, channel: ch, addresses: ["x"] },
        ]);
        const group = categories[category]?.group ?? null;
        assert.equal(preferenceVia(rows, category, ch, kindOf[category], group) !== null, verdict.stopped, JSON.stringify({ rows, category, ch }));
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
