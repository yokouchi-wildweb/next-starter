// src/lib/crud/presenters/domainColumns.test.ts
// 写しから作る一覧の列が、domain.json(正規化後)から作る列と同じことを確かめる。
// 実行: pnpm test:crud-presenters

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import sampleConfig from "@/features/sample/domain.json";
import couponConfig from "@/features/core/coupon/domain.json";
import chatRoomConfig from "@/features/core/chatRoom/domain.json";
import { domainDisplay as sampleDisplay } from "@/features/sample/entities/display";
import { domainDisplay as couponDisplay } from "@/features/core/coupon/entities/display";
import { domainDisplay as chatRoomDisplay } from "@/features/core/chatRoom/entities/display";

import { buildDomainColumns } from "./domainColumns";

type Row = Record<string, unknown>;
type Config = Parameters<typeof buildDomainColumns<Row>>[0]["config"];

const shape = (config: Config) =>
  buildDomainColumns<Row>({ config, sortableFields: true }).map(({ header, sortKey }) => ({ header, sortKey }));

const cases = [
  ["sample", sampleDisplay, sampleConfig],
  ["coupon", couponDisplay, couponConfig],
  ["chatRoom", chatRoomDisplay, chatRoomConfig],
] as const;

for (const [name, display, config] of cases) {
  test(`${name}: 列の見出しと並び替えキーが domain.json と同じ`, () => {
    const columns = shape(display);
    assert.ok(columns.length > 0);
    assert.deepEqual(columns, shape(normalizeDomainJsonConfig(config as Record<string, unknown>) as Config));
  });
}
