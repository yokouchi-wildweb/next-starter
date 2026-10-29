// src/utils/url.test.ts — pnpm test:utils-url
import { test } from "node:test";
import assert from "node:assert/strict";

import { isSafeHttpUrl } from "./url";

test("http / https だけを通す", () => {
  assert.equal(isSafeHttpUrl("https://example.com/a?b=1"), true);
  assert.equal(isSafeHttpUrl("http://example.com"), true);
  assert.equal(isSafeHttpUrl("  https://example.com  "), true);
});

test("危険なスキーム・相対パス・解析できない値は通さない", () => {
  for (const value of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "vbscript:x", "/relative", "example.com", "", "mailto:a@example.com"]) {
    assert.equal(isSafeHttpUrl(value), false, value);
  }
});
