// .notices/20261126-091213-cc-global-loader.global-loader.test.mjs — 区切り cc-global-loader の移し替えの道具の試し
// 実行: pnpm test .notices/20261126-091213-cc-global-loader.global-loader.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { plan, transformSource } from "./20261126-091213-cc-global-loader.global-loader.mjs";

const head = `import { useGlobalLoader } from "@/lib/globalLoader";\n\nexport function useRun() {\n  const { showLoader, hideLoader } = useGlobalLoader();\n`;

test("finally に hide がある形: show を終わりの関数に束ね、hide を呼び、分割代入から hideLoader を外す", () => {
  const src = `${head}  return async () => {
    showLoader("処理中…");
    try {
      await run();
    } finally {
      hideLoader();
    }
  };
}
`;
  const r = transformSource(src);
  assert.equal(r.status, "changed");
  assert.equal(
    r.text,
    `import { useGlobalLoader } from "@/lib/globalLoader";

export function useRun() {
  const { showLoader } = useGlobalLoader();
  return async () => {
    const endLoader = showLoader("処理中…");
    try {
      await run();
    } finally {
      endLoader();
    }
  };
}
`,
  );
  assert.equal(transformSource(r.text).status, "none", "2 回目は何もしない");
});

test("順の形: show と hide の間を try { … } finally { endLoader(); } で包む", () => {
  const src = `${head}  const run = async () => {
    showLoader({ message: "x" });
    await a();
    await b();
    hideLoader();
  };
  return run;
}
`;
  const r = transformSource(src);
  assert.equal(r.status, "changed");
  assert.match(r.text, /const endLoader = showLoader\(\{ message: "x" \}\);\n {4}try \{\n {6}await a\(\);\n {6}await b\(\);\n {4}\} finally \{\n {6}endLoader\(\);\n {4}\}\n {2}\};/);
  assert.doesNotMatch(r.text, /hideLoader/);
});

test("止まる形: 間の return・2 つの show・値として渡す hide・別の関数の hide・try の中の show", () => {
  const stop = (body) => {
    const r = transformSource(`${head}${body}}\n`);
    assert.equal(r.status, "stop", body);
    return r.reasons.join(" / ");
  };
  assert.match(stop(`  const f = async () => {\n    showLoader();\n    if (x) return;\n    hideLoader();\n  };\n  return f;\n`), /return・throw/);
  assert.match(stop(`  const f = () => {\n    showLoader("a");\n    showLoader("b");\n    hideLoader();\n  };\n  return f;\n`), /2 個/);
  assert.match(stop(`  useEffect(() => {\n    showLoader();\n    return hideLoader;\n  }, []);\n`), /値として渡している/);
  assert.match(stop(`  const a = () => showLoader();\n  const b = () => {\n    hideLoader();\n  };\n  return [a, b];\n`), /0 個/);
  assert.match(stop(`  const f = async () => {\n    try {\n      showLoader();\n      await run();\n    } finally {\n      hideLoader();\n    }\n  };\n  return f;\n`), /同じ塊の文でも finally の中でもない/);
});

test("hideLoader を受けない呼び手と useGlobalLoader の無いファイルは触らない", () => {
  assert.equal(transformSource(`import { useGlobalLoader } from "@/lib/globalLoader";\nconst { showLoader } = useGlobalLoader();\n`).status, "none");
  assert.equal(transformSource(`export const x = 1;\n`).status, "none");
});

test("plan: src の .ts/.tsx を見て、lib/globalLoader は外す", () => {
  const root = mkdtempSync(path.join(tmpdir(), "global-loader-"));
  const write = (rel, text) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  write("src/a/Run.tsx", `${head}  const f = async () => {\n    showLoader();\n    await go();\n    hideLoader();\n  };\n  return f;\n}\n`);
  write("src/lib/globalLoader/useGlobalLoader.ts", `${head}  hideLoader();\n}\n`);
  const { writes, stops } = plan(root);
  assert.deepEqual(writes.map((w) => w.file), ["src/a/Run.tsx"]);
  assert.deepEqual(stops, []);
});
