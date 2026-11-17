// Span の文中の指定 inline の検査(renderToStaticMarkup)。
// - inline を渡さない時: 既定・size / weight・tone / align・srOnly・inherit・className の出力が変更の前に記録した出力(__fixtures__/span.before.json)と同じ
// - inline: display inline・size / weight の既定は inherit(クラスを出さない)・leading-[inherit]、渡した size / weight / tone が出る
// 実行: pnpm test src/components/TextBlocks/Span.render.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup as r } from "react-dom/server";

import { Span } from "./Span";

const BEFORE = JSON.parse(readFileSync(new URL("./__fixtures__/span.before.json", import.meta.url), "utf8")) as Record<
  string,
  string
>;

test("inline なし: 出力が前と同じ", () => {
  assert.equal(r(<Span>t</Span>), BEFORE.plain);
  assert.equal(
    r(
      <Span size="sm" weight="bold">
        t
      </Span>,
    ),
    BEFORE.sizedBold,
  );
  assert.equal(
    r(
      <Span tone="muted" align="center">
        t
      </Span>,
    ),
    BEFORE.tone,
  );
  assert.equal(r(<Span srOnly>t</Span>), BEFORE.srOnly);
  assert.equal(
    r(
      <Span size="inherit" weight="inherit">
        t
      </Span>,
    ),
    BEFORE.inherit,
  );
  assert.equal(
    r(
      <Span className="truncate" data-x="1">
        t
      </Span>,
    ),
    BEFORE.className,
  );
  assert.equal(r(<Span inline={false}>t</Span>), BEFORE.plain);
});

const classes = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(" ");

test("inline: display inline・既定は親の大きさと太さ・行間も親", () => {
  const c = classes(r(<Span inline>t</Span>));
  assert.ok(c.includes("inline") && c.includes("leading-[inherit]"));
  for (const k of ["inline-block", "text-base", "font-normal", "leading-relaxed"]) assert.ok(!c.includes(k), k);
  const given = classes(
    r(
      <Span inline size="sm" weight="bold" tone="primary">
        t
      </Span>,
    ),
  );
  for (const k of ["inline", "text-sm", "font-bold", "text-primary"]) assert.ok(given.includes(k), k);
  assert.ok(!given.includes("inline-block"));
});
