// eslint-rules/intersection-observer.test.mjs
// 実行: pnpm test:intersection-observer

import { RuleTester } from "eslint";
import { test } from "node:test";

import plugin from "./intersection-observer.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

test("intersection-observer: 直書きの new を止め、型や別の observer は通す", () => {
  ruleTester.run("via-use-in-view", plugin.rules["via-use-in-view"], {
    valid: [
      { code: `const { ref, isInView } = useInView({ once: true });` },
      { code: `const o = new ResizeObserver(() => {});` },
      { code: `const o = new MutationObserver(() => {});` },
      { code: `const ok = typeof IntersectionObserver !== "undefined";` },
      { code: `const o = new foo.IntersectionObserver(() => {});` },
    ],
    invalid: [
      { code: `const o = new IntersectionObserver(() => {});`, errors: [{ messageId: "direct" }] },
      { code: `const o = new window.IntersectionObserver(() => {}, { threshold: 0.5 });`, errors: [{ messageId: "direct" }] },
      { code: `const o = new globalThis.IntersectionObserver(cb);`, errors: [{ messageId: "direct" }] },
      { code: `useEffect(() => {\n  const o = new IntersectionObserver(([e]) => set(e.isIntersecting));\n  o.observe(el);\n  return () => o.disconnect();\n}, []);`, errors: [{ messageId: "direct" }] },
    ],
  });
});
