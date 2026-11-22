// scripts/structure/message/scaffold.test.ts
// 連絡の書き出し(pnpm generate message の中身 ./scaffold.mjs)の検査。一時の木(地区の地図・カテゴリーと送信チャンネルの受け口の項目)で回す。
// - 引数なし = 何もしない / 定義 1 本を書く(レイアウト notice)/ 2 回目は何もしない(既にあるファイルは触らない)
// - exit 2: 知らない引数(--kind・--channels は無くなった)・地図に無いドメイン・camelCase でない名前・core に --core なし・
//   --category なし・受け口に無い category(名前の付け方を案内する)。送信チャンネルはカテゴリーから(fork の送信チャンネルの項目は通る)
// - 書いた定義は validateMessageDefinition(category・レイアウトの照らしも)と messageGuards の字面の検査を通る
// 実行: pnpm test scripts/structure/message/scaffold.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defineMessageLayout,
  validateMessageDefinition,
  MESSAGE_BLOCK_KINDS,
  type MessageCategory,
  type MessageDefinition,
  type MessageLayout,
} from "@/lib/messaging";

import { checkMessageGuards } from "../extensions/derive/messageGuards.mjs";
import { planExtensions } from "../extensions/extensions.mjs";
import { runMessageScaffold } from "./scaffold.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
/** 一時の木のカテゴリー(種別と送信チャンネルを持つ) */
const CATEGORIES: Record<string, MessageCategory> = {
  orderShipped: { key: "orderShipped", label: "発送した時", kind: "transactional", channels: ["email", "inApp"] },
  weeklyPromo: { key: "weeklyPromo", label: "週の宣伝", kind: "promotion", channels: ["inApp", "line"] },
  pushNotice: { key: "pushNotice", label: "プッシュ", kind: "activity", channels: ["push"] },
};

/** 書いた定義のレイアウト(本物の notice と同じ欄の形) */
const LAYOUTS: Record<string, MessageLayout> = {
  notice: defineMessageLayout({
    key: "notice",
    label: "汎用",
    fields: {
      subject: { type: "line", label: "件名", required: true },
      blocks: { type: "blocks", label: "本文", required: true, allow: MESSAGE_BLOCK_KINDS },
    },
    summary: (values) => ({ title: values.subject ?? "", body: "" }),
  }) as MessageLayout,
};
const LAYOUT_FILE = "src/domains/core/messaging/layouts/notice/layout.ts";

function tree() {
  const root = mkdtempSync(join(tmpdir(), "message-scaffold-"));
  // 書いた定義を読み込む時の zod などの解決(一時の木の外の node_modules を指す)
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"), "dir");
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  // domains の地区 = src/domains の下のフォルダ(業務 shop と core の wallet)
  put("src/domains/shop/README.md", "# shop\n");
  put("src/domains/core/wallet/README.md", "# wallet\n");
  for (const item of Object.values(CATEGORIES)) {
    put(`src/domains/core/messaging/categories/${item.key}.ts`, `export const category = ${JSON.stringify(item)};\n`);
  }
  put(LAYOUT_FILE, 'export const layout = { key: "notice" };\n');
  for (const channel of ["email/index.tsx", "inApp/index.ts", "line/index.ts", "push.ts"]) {
    put(`src/domains/core/messaging/channels/${channel}`, "export const channel = {};\n");
  }
  return root;
}

/** 名前(--label、必須)は既定で付ける。名前の無い場合は runMessageScaffold を直に呼ぶ */
const run = (root: string, ...args: string[]) => runMessageScaffold(root, args.length > 1 ? [...args, "--label", "連絡の名前"] : args);

/** 書いた定義を読み込んで検査する(@/lib/messaging は本物) */
async function problemsOf(root: string, path: string, channels: readonly string[] = ["email", "inApp", "line"]) {
  const { message } = (await import(join(root, path))) as { message: MessageDefinition };
  return validateMessageDefinition(message, { categories: CATEGORIES, layouts: LAYOUTS, channels }).map((p) => p.message);
}

/** 本物の宣言の messages の点で、書いた木に字面の守り(category も)を当てる */
function guardsOf(root: string, files: string[]) {
  type Point = Parameters<typeof checkMessageGuards>[1][number];
  const points = (planExtensions(repoRoot) as { points: Point[] }).points;
  const categoryFiles = Object.keys(CATEGORIES).map((key) => `src/domains/core/messaging/categories/${key}.ts`);
  return checkMessageGuards(root, points, [...files, ...categoryFiles, LAYOUT_FILE]);
}

test("引数なしは何もしない(exit 0)", () => {
  const root = tree();
  const result = run(root);
  assert.equal(result.code, 0);
  assert.deepEqual(result.written, []);
  assert.equal(runMessageScaffold(root, ["--"]).code, 0);
});

test("定義 1 本(レイアウト notice)を書き、2 回目は触らない", async () => {
  const root = tree();
  const result = run(root, "shop", "orderShipped", "--category", "orderShipped");
  assert.equal(result.code, 0, result.lines.join("\n"));
  assert.deepEqual(result.written, ["src/domains/shop/messages/orderShipped.ts"]);
  const definition = readFileSync(join(root, result.written[0]), "utf8");
  assert.match(definition, /key: "shop\.orderShipped"/);
  assert.match(definition, /category: "orderShipped"/);
  assert.match(definition, /label: "連絡の名前"/);
  assert.doesNotMatch(definition, /^\s*(kind|defaultChannels):/m);
  assert.match(definition, /種別 transactional・送信チャンネル email \/ inApp/);
  assert.match(definition, /secretVar/);
  assert.match(definition, /\/\/ 管理画面で直せる欄/);
  // 会話の間引きの案内は by に使う vars の鍵がある時だけ(書き出しの vars は空なので出ない)
  assert.doesNotMatch(definition, /\/\/ 会話の間引き/);
  assert.match(definition, /varNames: \{\}/);
  assert.doesNotMatch(definition, /^\s*(adminEditable|throttle):/m);
  assert.match(definition, /layout: "notice"/);
  assert.ok(!existsSync(join(root, "src/domains/shop/messages/views")));
  assert.deepEqual(await problemsOf(root, result.written[0]), []);
  assert.deepEqual(guardsOf(root, result.written), []);

  writeFileSync(join(root, result.written[0]), "// 手で直した\n" + definition);
  const again = run(root, "shop", "orderShipped", "--category", "orderShipped");
  assert.equal(again.code, 0);
  assert.deepEqual(again.written, []);
  assert.ok(again.lines.every((line) => line.includes("残しました")));
  assert.match(readFileSync(join(root, result.written[0]), "utf8"), /^\/\/ 手で直した/);
});

test("メールの無いカテゴリー・fork の送信チャンネルのカテゴリーも同じ定義 1 本(送信チャンネルの欄は書かない)", async () => {
  const root = tree();
  const promo = run(root, "shop", "weeklyPromo", "--category", "weeklyPromo");
  assert.equal(promo.code, 0, promo.lines.join("\n"));
  assert.deepEqual(promo.written, ["src/domains/shop/messages/weeklyPromo.ts"]);
  assert.match(readFileSync(join(root, promo.written[0]), "utf8"), /category: "weeklyPromo"/);
  assert.deepEqual(await problemsOf(root, promo.written[0]), []);
  assert.deepEqual(guardsOf(root, promo.written), []);

  const push = run(root, "shop", "pushOnly", "--category", "pushNotice");
  assert.equal(push.code, 0, push.lines.join("\n"));
  const text = readFileSync(join(root, push.written[0]), "utf8");
  assert.match(text, /送信チャンネル push/);
  assert.doesNotMatch(text, /content:/);
  assert.deepEqual(await problemsOf(root, push.written[0], ["email", "inApp", "line", "push"]), []);
});

test("core のドメインは --core の時だけ書く", () => {
  const root = tree();
  const refused = run(root, "wallet", "bonusNotice", "--category", "orderShipped");
  assert.equal(refused.code, 2);
  assert.match(refused.lines[0], /core のドメイン/);
  assert.equal(existsSync(join(root, "src/domains/core/wallet/messages/bonusNotice.ts")), false);
  const allowed = run(root, "wallet", "bonusNotice", "--category", "orderShipped", "--core");
  assert.equal(allowed.code, 0);
  assert.ok(existsSync(join(root, "src/domains/core/wallet/messages/bonusNotice.ts")));
});

test("exit 2: --label が無い・値が無い(管理画面の連絡の名前は必須)", () => {
  const root = tree();
  const missing = runMessageScaffold(root, ["shop", "hello", "--category", "orderShipped"]);
  assert.equal(missing.code, 2);
  assert.match(missing.lines[0], /--label が要る/);
  const empty = runMessageScaffold(root, ["shop", "hello", "--category", "orderShipped", "--label"]);
  assert.equal(empty.code, 2);
  assert.match(empty.lines[0], /--label に値/);
  const noCategoryValue = runMessageScaffold(root, ["shop", "hello", "--category"]);
  assert.match(noCategoryValue.lines[0], /--category に値/);
});

test("exit 2 と理由(何も書かない)", () => {
  const root = tree();
  const cases: [string[], RegExp][] = [
    [["shop", "x", "--category", "orderShipped", "--dry"], /知らない引数/],
    [["shop", "x", "--kind", "promotion"], /--kind は無くなりました/],
    [["shop", "x", "--channels", "email"], /--channels は無くなりました/],
    [["shop"], /<domain> と <name>/],
    [["nope", "hello", "--category", "orderShipped"], /domains の地区/],
    [["shop", "Hello", "--category", "orderShipped"], /camelCase/],
    [["shop", "hello.world", "--category", "orderShipped"], /camelCase/],
    [["shop", "hello"], /--category が要る.*1 つの出来事/],
    [["shop", "hello", "--category", "account"], /category account は categories の受け口に無い.*ドメイン・機能の単位/],
  ];
  for (const [args, pattern] of cases) {
    const result = run(root, ...args);
    assert.equal(result.code, 2, args.join(" "));
    assert.match(result.lines[0], pattern, args.join(" "));
    assert.deepEqual(result.written, []);
  }
  assert.equal(existsSync(join(root, "src/domains/shop/messages")), false);
});
