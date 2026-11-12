// scripts/structure/message/scaffold.test.ts
// 連絡の書き出し(pnpm generate message の中身 ./scaffold.mjs)の検査。一時の木(地区の地図・種類と経路の受け口の項目)で回す。
// - 引数なし = 何もしない / 書く 3 本(メールが無ければ定義だけ)/ 2 回目は何もしない(既にあるファイルは触らない)
// - exit 2: 知らない引数・地図に無いドメイン・camelCase でない名前・core に --core なし・知らない kind・受け口に無い category・
//   marketing / activity の category なし・知らない経路(fork の経路の項目は通る)
// - 書いた定義は validateMessageDefinition(category の照らしも)と messageGuards の字面の検査を通る
// 実行: pnpm test scripts/structure/message/scaffold.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateMessageDefinition, UPSTREAM_CHANNEL_FIELDS, type MessageDefinition } from "@/lib/messaging";
import { z } from "zod";

import { checkMessageGuards } from "../extensions/derive/messageGuards.mjs";
import { planExtensions } from "../extensions/extensions.mjs";
import { runMessageScaffold } from "./scaffold.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CATEGORIES = ["activity", "marketing"];

function tree() {
  const root = mkdtempSync(join(tmpdir(), "message-scaffold-"));
  // 書いた定義を読み込む時の zod などの解決(一時の木の外の node_modules を指す)
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"), "dir");
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  // features の地区 = src/features の下のフォルダ(業務 shop と core の wallet)
  put("src/features/shop/README.md", "# shop\n");
  put("src/features/core/wallet/README.md", "# wallet\n");
  for (const key of CATEGORIES) {
    put(`src/features/core/messaging/categories/${key}.ts`, `export const category = { key: "${key}", label: "${key}", kind: "${key}" };\n`);
  }
  for (const channel of ["email/index.tsx", "inApp/index.ts", "line/index.ts", "push.ts"]) {
    put(`src/features/core/messaging/channels/${channel}`, "export const channel = {};\n");
  }
  return root;
}

const run = (root: string, ...args: string[]) => runMessageScaffold(root, args);

/** 書いた定義を読み込んで検査する(@/lib/messaging は本物) */
async function problemsOf(root: string, path: string, channels: Record<string, z.ZodTypeAny> = UPSTREAM_CHANNEL_FIELDS) {
  const { message } = (await import(join(root, path))) as { message: MessageDefinition };
  return validateMessageDefinition(message, { categories: CATEGORIES, channels: channels as never }).map((p) => p.message);
}

/** 本物の宣言の messages の点で、書いた木に字面の守り(category も)を当てる */
function guardsOf(root: string, files: string[]) {
  type Point = Parameters<typeof checkMessageGuards>[1][number];
  const points = (planExtensions(repoRoot) as { points: Point[] }).points;
  const categoryFiles = CATEGORIES.map((key) => `src/features/core/messaging/categories/${key}.ts`);
  return checkMessageGuards(root, points, [...files, ...categoryFiles]);
}

test("引数なしは何もしない(exit 0)", () => {
  const root = tree();
  const result = run(root);
  assert.equal(result.code, 0);
  assert.deepEqual(result.written, []);
  assert.equal(runMessageScaffold(root, ["--"]).code, 0);
});

test("既定(取引・email + inApp)で 3 本を書き、2 回目は触らない", async () => {
  const root = tree();
  const result = run(root, "shop", "orderShipped");
  assert.equal(result.code, 0, result.lines.join("\n"));
  assert.deepEqual(result.written, [
    "src/features/shop/messages/orderShipped.ts",
    "src/features/shop/messages/views/orderShipped.tsx",
    "src/features/shop/messages/views/orderShipped.default.tsx",
  ]);
  const definition = readFileSync(join(root, result.written[0]), "utf8");
  assert.match(definition, /key: "shop\.orderShipped"/);
  assert.match(definition, /kind: "transactional"/);
  assert.doesNotMatch(definition, /^\s*category:/m);
  assert.match(definition, /secretVar/);
  assert.match(definition, /\/\/ 管理画面で直せる欄/);
  assert.match(definition, /\/\/ 会話の間引き/);
  assert.doesNotMatch(definition, /^\s*(adminEditable|throttle):/m);
  assert.equal(readFileSync(join(root, result.written[1]), "utf8").trim().split("\n").at(-1), 'export { EmailView } from "./orderShipped.default";');
  assert.match(readFileSync(join(root, result.written[2]), "utf8"), /export function EmailView/);
  assert.deepEqual(await problemsOf(root, result.written[0]), []);
  assert.deepEqual(guardsOf(root, result.written), []);

  writeFileSync(join(root, result.written[0]), "// 手で直した\n" + definition);
  const again = run(root, "shop", "orderShipped");
  assert.equal(again.code, 0);
  assert.deepEqual(again.written, []);
  assert.ok(again.lines.every((line) => line.includes("残しました")));
  assert.match(readFileSync(join(root, result.written[0]), "utf8"), /^\/\/ 手で直した/);
});

test("marketing は category つき、メールの無い連絡は定義だけ、fork の経路は空の欄 + 注記", async () => {
  const root = tree();
  const promo = run(root, "shop", "weeklyPromo", "--kind", "marketing", "--category", "marketing", "--channels", "inApp,line");
  assert.equal(promo.code, 0, promo.lines.join("\n"));
  assert.deepEqual(promo.written, ["src/features/shop/messages/weeklyPromo.ts"]);
  assert.match(readFileSync(join(root, promo.written[0]), "utf8"), /category: "marketing"/);
  assert.deepEqual(await problemsOf(root, promo.written[0]), []);
  assert.deepEqual(guardsOf(root, promo.written), []);

  const push = run(root, "shop", "pushOnly", "--channels", "push");
  assert.equal(push.code, 0, push.lines.join("\n"));
  const text = readFileSync(join(root, push.written[0]), "utf8");
  assert.match(text, /push: \{\},/);
  assert.match(text, /経路 push の欄/);
  assert.deepEqual(await problemsOf(root, push.written[0], { ...UPSTREAM_CHANNEL_FIELDS, push: z.object({}).strict() }), []);
});

test("core のドメインは --core の時だけ書く", () => {
  const root = tree();
  const refused = run(root, "wallet", "bonusNotice");
  assert.equal(refused.code, 2);
  assert.match(refused.lines[0], /core のドメイン/);
  assert.equal(existsSync(join(root, "src/features/core/wallet/messages/bonusNotice.ts")), false);
  const allowed = run(root, "wallet", "bonusNotice", "--core");
  assert.equal(allowed.code, 0);
  assert.ok(existsSync(join(root, "src/features/core/wallet/messages/bonusNotice.ts")));
});

test("exit 2 と理由(何も書かない)", () => {
  const root = tree();
  const cases: [string[], RegExp][] = [
    [["shop", "x", "--dry"], /知らない引数/],
    [["shop"], /<domain> と <name>/],
    [["nope", "hello"], /features の地区/],
    [["shop", "Hello"], /camelCase/],
    [["shop", "hello.world"], /camelCase/],
    [["shop", "hello", "--kind", "news"], /kind news/],
    [["shop", "hello", "--category", "account"], /category account は categories の受け口に無い/],
    [["shop", "hello", "--kind", "activity"], /activity の連絡は --category/],
    [["shop", "hello", "--channels", "email,fax"], /経路 fax/],
    [["shop", "hello", "--kind"], /--kind に値/],
  ];
  for (const [args, pattern] of cases) {
    const result = run(root, ...args);
    assert.equal(result.code, 2, args.join(" "));
    assert.match(result.lines[0], pattern, args.join(" "));
    assert.deepEqual(result.written, []);
  }
  assert.equal(existsSync(join(root, "src/features/shop/messages")), false);
});
