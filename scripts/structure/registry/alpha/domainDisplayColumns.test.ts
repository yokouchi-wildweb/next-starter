// scripts/structure/registry/alpha/domainDisplayColumns.test.ts
// 生成した写し(entities/display.ts)から作る一覧の列が、主の登録の entity.json(正規化後)から作る列と同じこと(写しが列に要る項目を落とさない)。
// 実行: pnpm test scripts/structure/registry/alpha/domainDisplayColumns.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDomainColumns, type DomainColumnDateFormatter, type DomainColumnTruncate } from "@/lib/crud";
import { normalizeDomainJsonConfig } from "@/lib/domain";
import sampleConfig from "@/domains/sample/entities/sample/entity.json";
import couponConfig from "@/domains/core/coupon/entities/coupon/entity.json";
import chatRoomConfig from "@/domains/core/chatRoom/entities/chatRoom/entity.json";
import { domainDisplay as sampleDisplay } from "@/domains/sample/entities/display";
import { domainDisplay as couponDisplay } from "@/domains/core/coupon/entities/display";
import { domainDisplay as chatRoomDisplay } from "@/domains/core/chatRoom/entities/display";

const formatDate: DomainColumnDateFormatter = (value, { format, fallback }) =>
  value == null ? fallback : `${format}|${String(value)}`;
const truncate: DomainColumnTruncate = (text, maxLength) =>
  text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
const formatting = { formatDate, truncate };

type Row = Record<string, unknown>;
type Config = Parameters<typeof buildDomainColumns<Row>>[0]["config"];

const shape = (config: Config) =>
  buildDomainColumns<Row>({ config, ...formatting, sortableFields: true }).map(({ header, sortKey }) => ({ header, sortKey }));

const cases = [
  ["sample", sampleDisplay, sampleConfig],
  ["coupon", couponDisplay, couponConfig],
  ["chatRoom", chatRoomDisplay, chatRoomConfig],
] as const;

for (const [name, display, config] of cases) {
  test(`${name}: 列の見出しと並び替えキーが entity.json と同じ`, () => {
    const columns = shape(display);
    assert.ok(columns.length > 0);
    assert.deepEqual(columns, shape(normalizeDomainJsonConfig(config as Record<string, unknown>) as Config));
  });
}
