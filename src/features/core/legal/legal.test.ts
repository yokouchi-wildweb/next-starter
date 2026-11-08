// src/features/core/legal/legal.test.ts — 法務の文書: 例文・印(sample / own)・差し込み・本番の検査(設定の議会 D21・D23・L1.24)。実行: pnpm test src/features/core/legal
import { test } from "node:test";
import assert from "node:assert/strict";

import { privacyConfig, termsConfig, tradelawConfig } from "@/config/documents";
import { legalConfigDef } from "@/features/core/legal/config";
import { EXAMPLE_BUSINESS } from "@/lib/business";
import type { LegalDocument } from "@/lib/structuredDocument/legal";

import { buildLegalDocument, checkLegalRelease, LEGAL_DOCUMENT_KINDS, LEGAL_EXAMPLES, sampleLegalDocuments, type LegalConfig } from "./index";

const base: LegalConfig = legalConfigDef.compose({});
const own: LegalDocument = { title: "{{SERVICE_NAME}} の規約", enactedAt: "2030年1月1日", sections: [{ title: "第一", content: ["{{COMPANY_NAME}} と {{PAYMENT_METHODS}}"], children: [{ content: ["{{EMAIL}}"] }] }] };

test("例文は今の src/config/documents の 3 文書の文面そのまま(日付と、許認可の節の組み立てを除く)", () => {
  const strip = ({ enactedAt: _e, lastUpdatedAt: _u, ...rest }: LegalDocument) => rest;
  assert.deepEqual(LEGAL_EXAMPLES.terms, strip(termsConfig));
  assert.deepEqual(LEGAL_EXAMPLES.privacy, strip(privacyConfig));
  // 今の殻の licenses は空なので、今の表示に許認可の節は無い。例文は id "licenses" の空の節を持つ
  assert.deepEqual(
    LEGAL_EXAMPLES.tradelaw.sections.filter((section) => section.id !== "licenses"),
    tradelawConfig.sections,
  );
  assert.deepEqual(LEGAL_EXAMPLES.tradelaw.sections.find((section) => section.id === "licenses"), { id: "licenses", title: "関連法令に基づく許認可" });
  for (const kind of LEGAL_DOCUMENT_KINDS) {
    assert.equal(LEGAL_EXAMPLES[kind].enactedAt, undefined, `${kind}: 例文は日付を持たない`);
    assert.equal(LEGAL_EXAMPLES[kind].lastUpdatedAt, undefined, `${kind}: 例文は日付を持たない`);
  }
});

test("既定は 3 文書とも sample で、今の表示と同じ文書を返す(差し込み・制定日 = launchedAt・許認可の節なし)", () => {
  assert.deepEqual(sampleLegalDocuments(base), ["terms", "privacy", "tradelaw"]);
  const terms = buildLegalDocument("terms", base, EXAMPLE_BUSINESS);
  assert.equal(terms.enactedAt, EXAMPLE_BUSINESS.launchedAt);
  assert.equal(terms.title, termsConfig.title);
  assert.ok(!JSON.stringify(terms).includes("{{"), "差し込みが残らない");
  assert.ok(JSON.stringify(terms).includes(EXAMPLE_BUSINESS.company.name));
  const tradelaw = buildLegalDocument("tradelaw", base, EXAMPLE_BUSINESS);
  assert.equal(tradelaw.enactedAt, undefined, "特商法の表示は今までどおり制定日を出さない");
  assert.ok(!tradelaw.sections.some((section) => section.id === "licenses"));
  assert.ok(JSON.stringify(tradelaw).includes(base.paymentMethods));
});

test("own は上書きの文面を返し、題名・本文・子の節に差し込む。日付は文面の値", () => {
  const config = legalConfigDef.compose({ documents: { terms: { source: "own", document: own } }, paymentMethods: "銀行振込" });
  const doc = buildLegalDocument("terms", config, EXAMPLE_BUSINESS);
  assert.equal(doc.title, `${EXAMPLE_BUSINESS.serviceName} の規約`);
  assert.equal(doc.enactedAt, "2030年1月1日");
  assert.deepEqual(doc.sections[0].content, [`${EXAMPLE_BUSINESS.company.name} と 銀行振込`]);
  assert.deepEqual(doc.sections[0].children?.[0].content, [EXAMPLE_BUSINESS.company.email]);
  assert.deepEqual(sampleLegalDocuments(config), ["privacy", "tradelaw"]);
});

test("許認可の欄があれば id licenses の節を埋める(key を省くと value だけ)", () => {
  const config = legalConfigDef.compose({ licenses: [{ type: "antique", label: "古物商許可", details: [{ key: "許可番号", value: "第1号" }, { value: "2030年1月1日" }] }] });
  const section = buildLegalDocument("tradelaw", config, EXAMPLE_BUSINESS).sections.find((s) => s.id === "licenses");
  assert.deepEqual(section?.content, ["**古物商許可**", "許可番号: 第1号", "2030年1月1日"]);
});

test("合成の検査: own に文面が無い・節が空なら ConfigValidationError", () => {
  assert.throws(() => legalConfigDef.compose({ documents: { terms: { source: "own" } as never } }), /legal/);
  assert.throws(() => legalConfigDef.compose({ documents: { privacy: { source: "own", document: { title: "x", sections: [] } } } }), /legal/);
});

test("本番の検査: sample の文書があれば本番で失敗(Tier1 は警告)、全部 own か本番でなければ通す", () => {
  assert.equal(checkLegalRelease({ samples: [], production: true, tier1: false }).level, "ok");
  assert.equal(checkLegalRelease({ samples: ["terms"], production: false, tier1: false }).level, "ok");
  const error = checkLegalRelease({ samples: ["terms", "tradelaw"], production: true, tier1: false });
  assert.equal(error.level, "error");
  assert.match(error.message ?? "", /pnpm ops legal from-example terms tradelaw/);
  assert.equal(checkLegalRelease({ samples: ["privacy"], production: true, tier1: true }).level, "warn");
});
