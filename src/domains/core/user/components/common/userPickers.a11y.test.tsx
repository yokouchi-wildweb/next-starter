// src/domains/core/user/components/common/userPickers.a11y.test.tsx
// 入力部品を包む core の picker(UserAsyncCombobox / UserAsyncMultiSelect)も、欄の枠が渡す 3 つ
// (id・aria-describedby・aria-invalid = FormControlA11yProps)をフォーカスされる要素へ付けるか。
// 棚の入力部品と組み込みの formInput の約束は src/lib/formSuite/a11yContract.test.tsx(lib はドメインを読まないので、ここに置く)
// 実行: pnpm test src/domains/core/user/components/common/userPickers.a11y.test.tsx
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";

import { UserAsyncCombobox } from "./UserAsyncCombobox";
import { UserAsyncMultiSelect } from "./UserAsyncMultiSelect";

const A11Y = { id: "probe-id", "aria-describedby": "probe-desc", "aria-invalid": true } as const;
const noop = () => {};
const FOCUSABLE = /^(input|textarea|select|button)$/;

/** id="probe-id" を持つ要素の開始タグを見て、約束を満たすかを返す(満たせば null) */
function checkTriple(html: string): string | null {
  const m = new RegExp(`<([a-z]+)((?:[^>](?!\\bid="))*[^>]*\\bid="${A11Y.id}"[^>]*)>`).exec(html);
  if (!m) return `id="${A11Y.id}" の要素が無い`;
  const [, tag, attrs] = m;
  if (!FOCUSABLE.test(tag) && !/\btabindex="0"/.test(attrs)) return `id がフォーカスされない <${tag}> に付いている`;
  if (!/\baria-describedby="[^"]+"/.test(attrs)) return `<${tag}> に aria-describedby が無い`;
  if (!/\baria-invalid="true"/.test(attrs)) return `<${tag}> に aria-invalid が無い`;
  return null;
}

test("core の picker: UserAsyncCombobox / UserAsyncMultiSelect も 3 つを渡す", () => {
  const failures: string[] = [];
  const cases: [string, ReactElement][] = [
    ["UserAsyncCombobox", createElement(UserAsyncCombobox, { ...A11Y, onChange: noop })],
    ["UserAsyncMultiSelect", createElement(UserAsyncMultiSelect, { ...A11Y, value: [], onChange: noop })],
  ];
  for (const [name, element] of cases) {
    const problem = checkTriple(renderToString(element));
    if (problem) failures.push(`${name}: ${problem}`);
  }
  assert.deepEqual(failures, []);
});
