// 達成通知の部品の描画の検査(レンダラーの一覧は偽物、renderToStaticMarkup で描く)。
// - 段階の鍵 → シリーズの鍵の順で引き、段階の鍵の項目が勝つ
// - シリーズの鍵で引いた結果は 1 つにまとめ、result = 一番上の段・seriesResults = 段の全部(下から)
// - レンダラーの無い結果・普通の定義は今と同じく 1 件ずつ(既定の通知)
// 実行: pnpm test src/features/core/milestone/components/MilestoneNotifications.render.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

import type { PersistedMilestoneResult } from "../types/milestone";
import type { MilestoneRendererProps } from "../types/milestoneRenderer";

const seen: { name: string; props: MilestoneRendererProps }[] = [];
const component = (name: string) => {
  const Probe = (props: MilestoneRendererProps) => {
    seen.push({ name, props });
    return createElement("span", null, `${name}:${props.result.milestoneKey}`);
  };
  Probe.displayName = `Probe(${name})`;
  return Probe;
};
mock.module("@/features/core/milestone/extensions/renderers", {
  namedExports: {
    renderers: {
      rank_up: { key: "rank_up", component: component("series") },
      rank_gold: { key: "rank_gold", component: component("gold-own") },
      first_purchase: { key: "first_purchase", component: component("first") },
    },
  },
});
mock.module("./DefaultMilestoneNotification", {
  namedExports: { DefaultMilestoneNotification: component("default") },
});

let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let MilestoneNotifications: typeof import("./MilestoneNotifications").MilestoneNotifications;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ MilestoneNotifications } = await import("./MilestoneNotifications"));
});

const stage = (key: string): PersistedMilestoneResult => ({ milestoneKey: key, achieved: true, seriesKey: "rank_up", stageKey: key });

test("シリーズの段はシリーズの鍵のレンダラー 1 つにまとまり、段階の鍵の項目が勝つ", () => {
  seen.length = 0;
  const html = renderToStaticMarkup(
    createElement(MilestoneNotifications, {
      results: [
        { milestoneKey: "first_purchase", achieved: true },
        stage("rank_bronze"),
        stage("rank_silver"),
        stage("rank_gold"),
        stage("rank_platinum"),
        { milestoneKey: "other", achieved: true },
        { milestoneKey: "not_achieved", achieved: false },
      ],
    }),
  );
  assert.deepEqual(
    seen.map((s) => `${s.name}:${s.props.result.milestoneKey}`),
    ["first:first_purchase", "series:rank_platinum", "gold-own:rank_gold", "default:other"],
  );
  const series = seen.find((s) => s.name === "series");
  assert.deepEqual(
    series?.props.seriesResults?.map((r) => r.milestoneKey),
    ["rank_bronze", "rank_silver", "rank_platinum"],
  );
  assert.equal(seen.find((s) => s.name === "gold-own")?.props.seriesResults, undefined);
  assert.ok(html.includes("series:rank_platinum"));
});

test("シリーズの鍵のレンダラーが無い段は 1 件ずつ既定の通知", () => {
  seen.length = 0;
  renderToStaticMarkup(
    createElement(MilestoneNotifications, {
      results: [
        { milestoneKey: "u_a", achieved: true, seriesKey: "unlock", stageKey: "u_a" },
        { milestoneKey: "u_b", achieved: true, seriesKey: "unlock", stageKey: "u_b" },
      ],
    }),
  );
  assert.deepEqual(seen.map((s) => `${s.name}:${s.props.result.milestoneKey}`), ["default:u_a", "default:u_b"]);
});
