// Button の iconSizing の検査(renderToStaticMarkup)
// - 渡さない / "auto": 出力が足す前に記録した出力(__fixtures__/button.before.json)と同じ(Primitives と Form/Button)
// - "none": 中の svg を 16px に揃える token だけが消え、ほかの class と属性は同じ
// 実行: pnpm test src/components/Primitives/Button
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup as r } from "react-dom/server";

import { Button } from "@/components/Form/Button";
import { Button as P } from "@/components/Primitives/Button";

const BEFORE = JSON.parse(readFileSync(new URL("./__fixtures__/button.before.json", import.meta.url), "utf8")) as Record<string, string>;
const TOKEN = "[&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4";

test("iconSizing を渡さない / auto の出力は前と同じ", () => {
  assert.equal(r(h(P, null, "x")), BEFORE.primitive);
  assert.equal(r(h(P, { iconSizing: "auto" }, "x")), BEFORE.primitive);
  assert.equal(r(h(P, { className: "w-full" }, "x")), BEFORE.primitiveClass);
  assert.equal(r(h(Button, null, "保存")), BEFORE.formDefault);
  assert.equal(r(h(Button, { variant: "none", size: "none", className: "rounded-full" }, "x")), BEFORE.formNone);
  assert.equal(r(h(Button, { variant: "outline", size: "sm", disabled: true }, "送信")), BEFORE.formOutline);
});

test("none は svg を揃える token だけを外す", () => {
  assert.ok(BEFORE.primitive.includes(TOKEN));
  assert.equal(r(h(P, { iconSizing: "none" }, "x")), BEFORE.primitive.replace(` ${TOKEN}`, ""));
  assert.equal(
    r(h(Button, { variant: "none", size: "none", className: "rounded-full", iconSizing: "none" }, "x")),
    BEFORE.formNone.replace(` ${TOKEN}`, ""),
  );
});
