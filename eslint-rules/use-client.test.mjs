// eslint-rules/use-client.test.mjs
// 実行: pnpm test eslint-rules/use-client.test.mjs

import { RuleTester } from "eslint";
import { test } from "node:test";

import plugin from "./use-client.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

test('use-client: hook を呼ぶファイルは "use client" が要る、use() とほかの関数・指示のあるファイルは通す', () => {
  ruleTester.run("hooks-need-directive", plugin.rules["hooks-need-directive"], {
    valid: [
      { code: `"use client"; import { useState } from "react"; export function A() { const [v] = useState(0); return v; }` },
      { code: `'use client'; export const useX = () => useSetting();` },
      { code: `"use strict"; "use client"; useEffect(() => {});` },
      { code: `import { use } from "react"; export function A({ p }) { return use(p); }` },
      { code: `export const user = getUser(); const u = userService.find();` },
      { code: `export function usefulHelper() { return username(); }` },
      { code: `import { useState } from "react"; export const ref = useState;` },
    ],
    invalid: [
      { code: `import { useState } from "react"; export function A() { const [v] = useState(0); useEffect(() => {}); return v; }`, errors: [{ messageId: "missing", data: { name: "useState" } }] },
      { code: `import * as React from "react"; export function A() { return React.useRef(null); }`, errors: [{ messageId: "missing" }] },
      { code: `export function useMine() { return useSWR("/x"); }`, errors: [{ messageId: "missing" }] },
      { code: `const x = 1; "use client"; useEffect(() => {});`, errors: [{ messageId: "missing" }] },
    ],
  });
});
