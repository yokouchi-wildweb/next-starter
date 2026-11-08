// scripts/operations/legal/legal.test.ts — 初期化の道具(pnpm ops legal from-example)の書き出し。実行: pnpm test scripts/operations/legal
import { test } from "node:test";
import assert from "node:assert/strict";

import { LEGAL_EXAMPLES } from "@/features/legal/documents";

import { overrideFileText, withExamples } from "./lib";

test("選んだ文書を例文の写しで own にし、他のキーと他の文書は残す", () => {
  const current = { paymentMethods: "銀行振込", documents: { privacy: { source: "sample" } } };
  const { value, written, skipped } = withExamples(current, ["terms"], LEGAL_EXAMPLES, false);
  assert.deepEqual(written, ["terms"]);
  assert.deepEqual(skipped, []);
  assert.equal(value.paymentMethods, "銀行振込");
  assert.deepEqual(value.documents?.privacy, { source: "sample" });
  assert.deepEqual(value.documents?.terms, { source: "own", document: LEGAL_EXAMPLES.terms });
  assert.notEqual((value.documents?.terms as { document: unknown }).document, LEGAL_EXAMPLES.terms, "写し(同じ物を指さない)");
});

test("既に own の文書は --force が無い限り変えない", () => {
  const mine = { source: "own", document: { title: "mine", sections: [{ content: ["x"] }] } };
  const kept = withExamples({ documents: { terms: mine } }, ["terms", "privacy"], LEGAL_EXAMPLES, false);
  assert.deepEqual(kept.written, ["privacy"]);
  assert.match(kept.skipped[0], /--force/);
  assert.equal(kept.value.documents?.terms, mine);
  assert.deepEqual(withExamples({ documents: { terms: mine } }, ["terms"], LEGAL_EXAMPLES, true).written, ["terms"]);
});

test("書き出しはリテラルの export default と型の満たし方の行(上書きの lint literal-only を通る形)", () => {
  const text = overrideFileText(withExamples({}, ["tradelaw"], LEGAL_EXAMPLES, false).value);
  assert.match(text, /^\/\/ src\/config\/features\/legal\.config\.ts\n/);
  assert.match(text, /import type \{ LegalOverride \} from "@\/features\/legal\/config";\n\nexport default \{\n {2}documents: \{\n {4}tradelaw: \{\n {6}source: "own",\n {6}document: \{/);
  assert.match(text, /\n\} satisfies LegalOverride;\n$/);
  assert.match(text, /id: "licenses",/);
});
