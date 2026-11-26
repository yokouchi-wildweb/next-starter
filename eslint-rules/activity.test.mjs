// eslint-rules/activity.test.mjs
// 実行: pnpm test eslint-rules/activity.test.mjs

import { RuleTester } from "eslint";
import { test } from "node:test";

import plugin from "./activity.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

test("activity: ref の守りの 1 回だけの初期化を、戻す所なしに書けば止める", () => {
  ruleTester.run("once-ref-guard", plugin.rules["once-ref-guard"], {
    valid: [
      // false に戻す所がある(二重送信の lock・失敗で戻す)
      { code: `const lockRef = useRef(false); useEffect(() => { if (lockRef.current) return; lockRef.current = true; go().finally(() => { lockRef.current = false; }); }, []);` },
      // useOnPageLeave で戻す
      { code: `const doneRef = useRef(false); useEffect(() => { if (doneRef.current) return; doneRef.current = true; start(); }, [start]); useOnPageLeave(() => { doneRef.current = false; });` },
      // effect の外(useCallback の中)の守りは見ない
      { code: `const firedRef = useRef(false); const fire = useCallback(() => { if (firedRef.current) return; firedRef.current = true; send(); }, []);` },
      // useRef(true) は見ない
      { code: `const aliveRef = useRef(true); useEffect(() => { if (!aliveRef.current) return; aliveRef.current = true; }, []);` },
    ],
    invalid: [
      { code: `const doneRef = useRef(false); useEffect(() => { if (doneRef.current) return; doneRef.current = true; start(); }, [start]);`, errors: [{ messageId: "once" }] },
      { code: `const startedRef = useRef(false); useLayoutEffect(() => { if (!enabled || startedRef.current) { return; } startedRef.current = true; }, [enabled]);`, errors: [{ messageId: "once" }] },
      { code: `const frozenRef = useRef(false); useEffect(() => { if (!node || frozenRef.current) return; const o = make(() => { frozenRef.current = true; }); return () => o.stop(); }, [node]);`, errors: [{ messageId: "once" }] },
    ],
  });
});
