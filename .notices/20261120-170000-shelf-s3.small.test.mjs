// .notices/20261120-170000-shelf-s3.small.test.mjs
// codemod shelf-s3 small: 動いたモジュール(@/utils/object・@/utils/json・@/hooks/useAppStatus)・名前ごとに分かれた入口(tableSuite の toOrderBySpec)・行き先の入口の名前の確かめ・
// 無くなったモジュール(AppStatusGuard・DarkModeSwitch)の STOP と手順・単位の中の読み・plan と apply・何度走らせても同じ
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { apply, mapModule, plan, rewriteSource } from "./20261120-170000-shelf-s3.small.mjs";

const repo = (files) => {
  const root = mkdtempSync(path.join(tmpdir(), "shelf-s3-small-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
};

test("注文 12: @/utils/object・@/utils/json・@/hooks/useAppStatus は行き先へ(別名・相対・src/ の道)", () => {
  assert.equal(mapModule("src/utils/object").to, "src/lib/crud/utils");
  assert.equal(mapModule("src/utils/json").to, "src/lib/firebase/serviceAccountKey");
  assert.equal(mapModule("src/hooks/useAppStatus").to, "src/lib/appStatus");
  assert.equal(mapModule("src/utils/date"), null, "ほかの utils はそのまま");
  const src = [
    'import { omitUndefined } from "@/utils/object";',
    'import { useAppStatus } from "../../../hooks/useAppStatus";',
    'import { normalizeJsonString } from "@/utils/json";',
  ].join("\n");
  const { text, stops } = rewriteSource("src/features/shop/hooks/useShop.ts", src);
  assert.deepEqual(stops, []);
  assert.equal(
    text,
    [
      'import { omitUndefined } from "@/lib/crud/utils";',
      'import { useAppStatus } from "@/lib/appStatus";',
      'import { normalizeJsonString } from "@/lib/firebase/serviceAccountKey";',
    ].join("\n"),
  );
});

test("注文 12: 移った名前が行き先の入口に無ければ書かずに STOP(入口がこの木にあるときだけ確かめる)", () => {
  const exportsOf = (mod) => (mod === "src/lib/crud/utils" ? new Set(["buildWhere"]) : null);
  const src = 'import { omitUndefined } from "@/utils/object";';
  const { text, stops } = rewriteSource("src/features/shop/x.ts", src, { exportsOf });
  assert.equal(text, src);
  assert.equal(stops.length, 1);
  assert.match(stops[0], /omitUndefined が無い/);
});

test("注文 13: @/lib/tableSuite の toOrderBySpec だけ @/lib/crud へ、ほかの名前(型も)は tableSuite に残る。書いていないファイルはそのまま", () => {
  const src = 'import { DataTable, parseSortState, toOrderBySpec, type SortState } from "@/lib/tableSuite";';
  const { text, stops } = rewriteSource("src/features/shop/components/ShopList.tsx", src);
  assert.deepEqual(stops, []);
  assert.match(text, /import \{ DataTable, parseSortState, type SortState \} from "@\/lib\/tableSuite";/);
  assert.match(text, /import \{ toOrderBySpec \} from "@\/lib\/crud";/);
  const other = 'import { DataTable, type SortState } from "@/lib/tableSuite";';
  assert.equal(rewriteSource("src/features/shop/components/Other.tsx", other).text, other);
});

test("AppStatusGuard: 読む所(import・JSX・mock.module)は書かずに STOP、手順は useAppStatus の呼び出し(props の無い形は oripa-do の RaidPlayClient)", () => {
  const src = [
    '"use client";',
    'import { AppStatusGuard } from "@/components/AppStatusGuard";',
    "export function RaidPlayClient() {",
    "  return <><AppStatusGuard /><Board /></>;",
    "}",
  ].join("\n");
  const { text, stops } = rewriteSource("src/features/raid/components/RaidPlayClient.tsx", src);
  assert.equal(text, src);
  assert.equal(stops.length, 1);
  assert.match(stops[0], /^2: @\/components\/AppStatusGuard は無くなった/);
  assert.match(stops[0], /`useAppStatus\(\);`/);
  assert.match(stops[0], /useAppStatus\(\{ intervalMs: n, enabled: b \}\)/);
  assert.match(stops[0], /@\/lib\/appStatus/);
  assert.match(stops[0], /RaidPlayClient/);
  const mock = rewriteSource("src/features/raid/x.test.tsx", 'mock.module("@/components/AppStatusGuard", { namedExports: {} });');
  assert.equal(mock.stops.length, 1);
});

test("DarkModeSwitch: 読む所は STOP、手順は useDarkModeSwitch と Button", () => {
  const { stops } = rewriteSource("src/app/(user)/_layout/Header.tsx", 'import { DarkModeSwitch } from "@/components/Functional/DarkModeSwitch";');
  assert.equal(stops.length, 1);
  assert.match(stops[0], /useDarkModeSwitch/);
  assert.match(stops[0], /@\/components\/Button\/Button/);
});

test("単位の中のファイルが同じ単位の中を読む指定と、表に無い道はそのまま", () => {
  const inside = 'import { useAppStatus } from "./useAppStatus";\nimport { x } from "./parts/x";';
  const res = rewriteSource("src/lib/appStatus/index.ts", inside);
  assert.equal(res.text, inside);
  assert.deepEqual(res.stops, []);
  const other = 'import { formatDate } from "@/utils/date";\nimport { Button } from "@/components/Button/Button";';
  assert.equal(rewriteSource("src/features/x/a.tsx", other).text, other);
});

test("plan と apply: 書き換え・文書は一覧だけ・止める所があれば書かない、2 回目は変えるものなし", () => {
  const root = repo({
    "src/features/shop/a.ts": 'import { omitUndefined } from "@/utils/object";\nexport const a = omitUndefined;\n',
    "src/lib/crud/utils/index.ts": "export * from \"./object\";\n",
    "src/lib/crud/utils/object.ts": "export const omitUndefined = 1;\n",
    "src/features/shop/README.md": "`@/hooks/useAppStatus` を使う\n",
  });
  const first = plan(root);
  assert.deepEqual(first.stops, []);
  assert.deepEqual(first.hands.map((h) => `${h.file}:${h.line}`), ["src/features/shop/README.md:1"]);
  apply(root, first);
  assert.equal(readFileSync(path.join(root, "src/features/shop/a.ts"), "utf8"), 'import { omitUndefined } from "@/lib/crud/utils";\nexport const a = omitUndefined;\n');
  const second = plan(root);
  assert.equal(second.rewrites.length + second.moves.length + second.stops.length, 0);

  const blocked = repo({
    "src/components/AppStatusGuard/Mine.tsx": "export const Mine = 1;\n",
    "src/app/x.tsx": 'import { AppStatusGuard } from "@/components/AppStatusGuard";\n',
  });
  const stopped = plan(blocked);
  assert.deepEqual(stopped.stops.map((s) => s.file).sort(), ["src/app/x.tsx", "src/components/AppStatusGuard/Mine.tsx"]);
});
