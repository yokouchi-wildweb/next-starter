// src/lib/messaging/definition.test.ts
//
// 連絡定義の型と読み手の検査(validateMessageDefinition・applyMessageOverride)。定義 = レイアウト + 欄の中身(D122)。
// - 正しい定義が通る / 止める物(required の守り・レイアウト・欄の中身・adminEditableOnly・{{鍵}}・throttle・鍵の形)が止まる
// - 欄の中身はカテゴリーの送信チャンネルで使う欄だけ必須(D125) / 上書きは欄ごとに重ねる / 型の絞りは @ts-expect-error で固定
// 実行: pnpm test src/lib/messaging/definition.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  CHANNEL_ERROR_KINDS,
  ChannelError,
  MESSAGE_BLOCK_KINDS,
  MESSAGE_KINDS,
  MESSAGE_KIND_TRAITS,
  applyMessageOverride,
  defineMessage,
  defineMessageLayout,
  extensionPoints,
  kindTraits,
  kindsWhere,
  resolveMessageDefinition,
  validateMessageCategories,
  validateMessageDefinition,
  type MessageCategory,
  type MessageLayout,
  type MessageOverride,
} from "./index";

/** テストのレイアウト: 件名 + ブロック / メールだけの欄を持つレイアウト */
const LAYOUTS: Record<string, MessageLayout> = {
  notice: defineMessageLayout({
    key: "notice",
    label: "汎用のお知らせ",
    fields: {
      subject: { type: "line", label: "件名", required: true },
      blocks: { type: "blocks", label: "本文", required: true, allow: MESSAGE_BLOCK_KINDS },
    },
    summary: (values) => ({ title: values.subject ?? "", body: "" }),
  }) as MessageLayout,
  split: defineMessageLayout({
    key: "split",
    label: "経路だけの欄",
    fields: {
      title: { type: "line", label: "題", required: true },
      mailOnly: { type: "paragraph", label: "メールだけ", required: true, channels: ["email"] },
    },
    summary: (values) => ({ title: values.title ?? "", body: "" }),
  }) as MessageLayout,
};

const verification = defineMessage({
  key: "auth.verification",
  label: "テストの連絡",
  category: "account",
  vars: z.object({ verificationUrl: z.string().url() }),
  varNames: { verificationUrl: { alias: "確認のURL", description: "メールアドレスを確かめるリンク" } },
  required: true,
  record: "meta",
  layout: "notice",
  values: {
    subject: "メールアドレスの確認",
    blocks: [
      { type: "paragraph", text: "{{recipientName}} 様、{{serviceName}} への登録を受け付けました。" },
      { type: "button", label: "確認する", url: "{{verificationUrl}}" },
    ],
  },
});

const reply = defineMessage({
  key: "chat.reply",
  label: "テストの連絡",
  category: "chat",
  vars: z.object({ roomId: z.string(), senderName: z.string() }),
  varNames: { roomId: { alias: "部屋の番号", description: "会話の部屋" }, senderName: { alias: "送った人", description: "返信した人の名前" } },
  adminEditableOnly: ["subject"],
  throttle: { by: ["roomId"], mode: "untilRead", seconds: 600 },
  layout: "notice",
  values: {
    subject: "{{senderName}} さんから返信",
    blocks: [
      { type: "paragraph", text: "ほか {{collapsedCount}} 件" },
      { type: "button", label: "開く", url: "{{appBaseUrl}}/rooms/{{roomId}}" },
    ],
  },
});

const codes = (problems: { code: string }[]) => problems.map((p) => p.code).sort();

/** テストのカテゴリー(種別と送信チャンネルはカテゴリーから引く) */
const CATEGORIES: Record<string, MessageCategory> = {
  account: { key: "account", label: "アカウント", kind: "functional", channels: ["email"] },
  accountInApp: { key: "accountInApp", label: "アカウント(お知らせ)", kind: "transactional", channels: ["inApp"] },
  chat: { key: "chat", label: "チャット", kind: "activity", channels: ["inApp", "email"] },
  chatLine: { key: "chatLine", label: "チャット(LINE も)", kind: "activity", channels: ["inApp", "email", "line"] },
  push: { key: "push", label: "プッシュ", kind: "activity", channels: ["push"] },
  order: { key: "order", label: "注文", kind: "transactional", channels: ["push"] },
  alert: { key: "alert", label: "警告", kind: "security", channels: ["email"] },
};
const validate = (definition: Parameters<typeof validateMessageDefinition>[0], options: Partial<Parameters<typeof validateMessageDefinition>[1]> = {}) =>
  validateMessageDefinition(definition, { categories: CATEGORIES, layouts: LAYOUTS, ...options });

test("正しい定義は問題なし", () => {
  assert.deepEqual(validate(verification), []);
  assert.deepEqual(validate(reply), []);
});

test("label(管理画面の連絡の名前)は必須で空にできない、上書きで変えられる(表示だけ)", () => {
  const codes = (problems: { code: string }[]) => problems.map((p) => p.code);
  assert.ok(codes(validate({ ...verification, label: "" })).includes("missing_label"));
  assert.ok(codes(validate({ ...verification, label: undefined } as never)).includes("missing_label"));
  assert.ok(codes(validate(verification, { override: { label: " " } })).includes("missing_label"));
  assert.deepEqual(validate(verification, { override: { label: "メールの確認(別の言い方)" } }), []);
  assert.equal(applyMessageOverride(verification, { label: "別の名前" }).label, "別の名前");
});

test("required の守り: email の除外・adminEditable・throttle を止める", () => {
  const def = defineMessage({
    ...verification,
    category: "accountInApp",
    adminEditableOnly: ["subject"],
    throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 },
  });
  assert.deepEqual(codes(validate(def)), [
    "required_admin_editable",
    "required_throttle",
    "required_without_email",
  ]);
});

test("上書きを重ねた結果を検査: required への enabled:false・email の除外・adminEditable の付与を止める", () => {
  const override: MessageOverride = {
    enabled: false,
    adminEditableOnly: ["subject"],
    values: { subject: "確認" },
  };
  // 送信チャンネルはカテゴリーが決めるので上書きで email を外せない(required_without_email はカテゴリーの送信チャンネルで見る)。functional のカテゴリーはテキストの編集も不可
  assert.deepEqual(codes(validate(verification, { override })), [
    "kind_admin_editable",
    "required_admin_editable",
    "required_disabled",
  ]);
});

test("上書きで key・kind・vars・required・category・defaultChannels は変えられない", () => {
  const override = { required: false, key: "auth.other", label: "テストの連絡", category: "chat", defaultChannels: ["email"] } as never;
  assert.deepEqual(codes(validate(verification, { override })), [
    "override_forbidden_key",
    "override_forbidden_key",
    "override_forbidden_key",
    "override_forbidden_key",
  ]);
});

test("上書きの重ね方: 欄の中身は欄ごとに差し替え、throttle: null で外す", () => {
  const resolved = applyMessageOverride(reply, {
    values: { subject: "新しい件名 {{senderName}}" },
    extras: { badge: "NEW" },
    throttle: null,
  });
  assert.equal(resolved.enabled, true);
  assert.equal(resolved.values.subject, "新しい件名 {{senderName}}");
  assert.deepEqual(resolved.values.blocks, reply.values.blocks);
  assert.deepEqual(resolved.extras, { badge: "NEW" });
  assert.equal(resolved.throttle, undefined);
  // 元の定義は変えない
  assert.equal(reply.values.subject, "{{senderName}} さんから返信");
  assert.ok(reply.throttle);
  // throttle を外すと {{collapsedCount}} は差し込めない
  assert.deepEqual(codes(validate(reply, { override: { throttle: null } })), [
    "unknown_variable",
  ]);
});

test("欄の中身の {{鍵}} は vars ∪ 共通の文脈(∪ throttle の collapsedCount)に在ること", () => {
  const def = defineMessage({
    ...verification,
    values: {
      subject: "{{recipient.name}} {{unknownKey}} {{recipientEmail}} {{appBaseUrl}}",
      blocks: [{ type: "paragraph", text: "{{collapsedCount}}" }],
    },
  });
  const problems = validate(def);
  assert.deepEqual(codes(problems), ["unknown_variable", "unknown_variable"]);
  assert.ok(problems.some((p) => p.message.includes("{{unknownKey}}")));
  assert.ok(problems.some((p) => p.message.includes("{{collapsedCount}}")));
});

test("variableKeys で足した鍵(enrichers の provides)は {{鍵}} で許す", () => {
  const def = defineMessage({ ...verification, values: { ...verification.values, subject: "{{points}} {{unknownKey}}" } });
  assert.deepEqual(codes(validate(def)), ["unknown_variable", "unknown_variable"]);
  const problems = validate(def, { variableKeys: ["points"] });
  assert.deepEqual(codes(problems), ["unknown_variable"]);
  assert.ok(problems[0].message.includes("{{unknownKey}}"));
});

test("レイアウトと欄の中身: 受け口に無いレイアウト・欄の zod に合わない・知らない欄・知らない送信チャンネル・定義に無い adminEditable", () => {
  assert.deepEqual(codes(validate({ ...reply, layout: "nope" })), ["unknown_layout"]);
  assert.deepEqual(codes(validate({ ...reply, values: { subject: "", blocks: reply.values.blocks } })), ["invalid_values"]);
  assert.deepEqual(codes(validate({ ...reply, values: { ...reply.values, title: "欄の名前は変えられない" } })), ["invalid_values"]);
  assert.deepEqual(codes(validate({ ...reply, values: { subject: "s" } })), ["invalid_values"]);

  const unknownChannel = { ...reply, category: "push", adminEditableOnly: [] } as never;
  assert.deepEqual(codes(validate(unknownChannel)), ["unknown_channel"]);

  const unknownField = { ...reply, adminEditableOnly: ["subjectLine", "email.subject"] } as never;
  assert.deepEqual(codes(validate(unknownField)), [
    "unknown_admin_editable",
    "unknown_admin_editable",
  ]);
});

test("送信チャンネルだけの欄はカテゴリーの送信チャンネルで使う時だけ必須(D125)", () => {
  const def = defineMessage({ ...reply, adminEditableOnly: undefined, category: "accountInApp", layout: "split", values: { title: "題" } });
  // inApp だけのカテゴリー: メールだけの欄は要らない
  assert.deepEqual(validate(def), []);
  // email のあるカテゴリー: メールだけの欄が要る
  assert.deepEqual(codes(validate({ ...def, category: "chat" })), ["invalid_values"]);
  assert.deepEqual(validate({ ...def, category: "chat", values: { title: "題", mailOnly: "本文" } }), []);
});

test("throttle の検査と鍵の形", () => {
  const def = { ...reply, key: "ChatReply", throttle: { by: ["nope"], mode: "window", seconds: 0 } } as never;
  assert.deepEqual(codes(validate(def)), [
    "invalid_key",
    "invalid_throttle",
    "invalid_throttle",
  ]);
});

test("カテゴリーの検査: 受け口に無い鍵は誤り、種別の性質でテキストの編集・間引きを止める", () => {
  assert.deepEqual(codes(validate({ ...verification, category: "nope" })), ["unknown_category"]);
  // security は間引けない、functional はテキストの編集ができない(required でなくても)
  const alert = defineMessage({ ...verification, category: "alert", required: false, throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 } });
  assert.deepEqual(codes(validate(alert)), ["kind_throttle"]);
  const functional = defineMessage({ ...verification, required: false, adminEditableOnly: ["subject"] });
  assert.deepEqual(codes(validate(functional)), ["kind_admin_editable"]);
  // 種別と送信チャンネルはカテゴリーから付く
  const resolved = resolveMessageDefinition(reply, undefined, CATEGORIES.chat);
  assert.equal(resolved.kind, "activity");
  assert.deepEqual(resolved.channels, ["inApp", "email"]);
});

test("カテゴリーの受け口の検査: 種別・送信チャンネル・グループ(同じ種別だけ)", () => {
  const groups = { social: { key: "social", label: "交流", order: 1 } };
  assert.deepEqual(
    validateMessageCategories(
      {
        like: { key: "like", label: "いいね", kind: "activity", channels: ["inApp"], group: "social" },
        follow: { key: "follow", label: "フォロー", kind: "activity", channels: ["inApp"], group: "social" },
      },
      groups,
    ),
    [],
  );
  const problems = validateMessageCategories(
    {
      like: { key: "like", label: "いいね", kind: "activity", channels: ["inApp"], group: "social" },
      promo: { key: "promo", label: "宣伝", kind: "promotion", channels: ["email"], group: "social" },
      lost: { key: "lost", label: "迷子", kind: "activity", channels: [], group: "nope" },
      odd: { key: "odd", label: "変", kind: "weird" as never, channels: ["email"] },
    },
    groups,
  );
  assert.deepEqual(problems.map((p) => p.code).sort(), ["empty_channels", "group_kind_mismatch", "unknown_group", "unknown_kind"]);
});

test("種別の性質の表(D80)", () => {
  assert.deepEqual([...MESSAGE_KINDS], ["functional", "transactional", "security", "announcement", "direct", "activity", "promotion"]);
  assert.deepEqual(kindsWhere((t) => t.userStoppable), ["activity", "promotion"]);
  assert.deepEqual(kindsWhere((t) => !t.upstreamDisable), ["functional"]);
  assert.deepEqual(kindsWhere((t) => t.addressStop === "hardBounce"), ["functional", "security"]);
  assert.deepEqual(kindsWhere((t) => t.adminFreeText.length > 0), ["announcement", "direct", "promotion"]);
  assert.deepEqual(kindsWhere((t) => !t.throttle), ["functional", "security"]);
  assert.deepEqual(kindsWhere((t) => !t.adminTextOverride), ["functional"]);
  assert.deepEqual(kindsWhere((t) => t.emailFixed), ["functional", "security"]);
  assert.deepEqual(kindsWhere((t) => t.sendInEntry), ["security"]);
  assert.equal(MESSAGE_KIND_TRAITS.direct.recordDefault, "full");
  assert.equal(MESSAGE_KIND_TRAITS.security.recordDefault, "meta");
  assert.equal(kindTraits("transactional")?.recordDefault, "vars");
  assert.equal(kindTraits("nope"), null);
});

test("fork の送信チャンネル: 登録された送信チャンネルの鍵(channels)でカテゴリーの送信チャンネルの有無を見る(送信チャンネルは欄を持たない、D122)", () => {
  const def = defineMessage({
    key: "shop.orderShipped",
    label: "テストの連絡",
    category: "order",
    vars: z.object({ orderId: z.string() }),
    varNames: { orderId: { alias: "注文番号", description: "注文の番号" } },
    adminEditableOnly: ["subject"],
    layout: "notice",
    values: { subject: "発送しました", blocks: [{ type: "paragraph", text: "注文 {{orderId}}" }] },
  });
  assert.deepEqual(validate(def, { channels: ["email", "inApp", "line", "push"] }), []);
  // 既定(上流の 3 送信チャンネル)で読むと push は知らない送信チャンネル
  assert.ok(codes(validate(def)).includes("unknown_channel"));
});

test("vars の名前(varNames、D133): 全部の鍵に別名と説明、vars に無い鍵の名前は誤り", () => {
  assert.ok(codes(validate({ ...reply, varNames: { roomId: reply.varNames.roomId } } as never)).includes("missing_var_name"));
  assert.ok(codes(validate({ ...reply, varNames: { ...reply.varNames, nope: { alias: "無い", description: "x" } } } as never)).includes("invalid_var_name"));
  // 上書きで変えられない
  assert.ok(codes(validate(reply, { override: { varNames: {} } as never })).includes("override_forbidden_key"));
});

test("ChannelError は lib/mail と同じ 3 分類を持つ Error", () => {
  assert.deepEqual([...CHANNEL_ERROR_KINDS], ["transient", "permanent", "unknown"]);
  const error = new ChannelError({ message: "届かない", kind: "permanent", channel: "line", reason: "invalid_address" });
  assert.ok(error instanceof Error);
  assert.equal(error.kind, "permanent");
  assert.equal(error.channel, "line");
  assert.equal(error.reason, "invalid_address");
});

test("型の絞り(型検査で固定。実行は何もしない)", () => {
  const vars = z.object({ a: z.string() });
  const varNames = { a: { alias: "エー", description: "a" } };
  defineMessage({
    // @ts-expect-error 鍵は <domain>.<name>
    key: "noDot",
    label: "テストの連絡",
    category: "x",
    vars,
    varNames,
    layout: "notice",
    values: {},
  });
  defineMessage({
    key: "x.y",
    label: "テストの連絡",
    category: "x",
    vars,
    varNames,
    // @ts-expect-error throttle.by は vars の鍵
    throttle: { by: ["b"], mode: "window", seconds: 1 },
    layout: "notice",
    values: {},
  });
  // @ts-expect-error レイアウト(layout)は必須
  defineMessage({ key: "x.y", label: "テストの連絡", category: "x", vars, varNames, values: {} });
  // @ts-expect-error vars の名前(varNames)は全部の鍵に要る
  defineMessage({ key: "x.y", label: "テストの連絡", category: "x", vars, varNames: {}, layout: "notice", values: {} });
});

// 上書きの型の鍵 = 宣言の overrideOf(どちらかに足すと型検査で落ちる)
type DeclaredKeys = (typeof extensionPoints.messages.overrideOf)[number];
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const overrideKeysMatch: Equal<keyof MessageOverride, DeclaredKeys> = true;

test("上書きの型の鍵と宣言の overrideOf は同じ", () => {
  assert.equal(overrideKeysMatch, true);
  assert.deepEqual([...extensionPoints.messages.overrideOf].sort(), [
    "adminEditableOnly",
    "enabled",
    "extras",
    "label",
    "record",
    "throttle",
    "values",
  ]);
});
