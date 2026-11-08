// マイルストーン定義の読み手(項目: ./definitions/<名前>.ts の export const milestone、一覧は生成物)
// ベースリポジトリの項目は 0。項目は普通の定義か段階のあるシリーズ(MilestoneSeries)。
// シリーズは呼ぶたびに stages() から段階ごとの定義へ展開する(段階は config・setting から毎回読む)。
// 戻りはどれも展開後の MilestoneDefinition(段階のものは series の印付き)。
//
// 使い方（下流プロジェクト）:
// ```ts
// export const milestone: MilestoneDefinition = {
//   key: "first_purchase",
//   triggers: ["purchase_completed"],
//   evaluate: async ({ userId }, tx) => {
//     const { data } = await purchaseRequestService.search({ ... });
//     return data.length === 1;
//   },
//   onAchieved: async ({ userId, tx }) => {
//     await walletService.adjustBalance({ userId, ... }, tx);
//     return { reward: "500 coins" };
//   },
// };
// ```

import { definitions } from "@/features/core/milestone/extensions/definitions";

import {
  isMilestoneSeries,
  type MilestoneDefinition,
  type MilestoneItem,
  type MilestoneSeries,
} from "../../types/milestone";

/** シリーズの段階ごとの定義(段階を閉じ込めた evaluate / onAchieved) */
function expandSeries(series: MilestoneSeries<unknown>): MilestoneDefinition[] {
  return series.stages().map((stage, index) => {
    const stageKey = series.stageKey(stage);
    if (typeof stageKey !== "string" || stageKey.trim() === "") {
      throw new Error(`マイルストーンのシリーズ "${series.key}" の段階 ${index} の stageKey が空です。段階の名前から鍵を作ってください。`);
    }
    const onAchieved = series.onAchieved;
    return {
      key: stageKey,
      triggers: series.triggers,
      evaluate: (context, tx) => series.evaluate(stage, context, tx),
      onAchieved: onAchieved ? (params) => onAchieved(stage, params) : undefined,
      series: { seriesKey: series.key, stageKey, index, order: series.order },
    };
  });
}

/**
 * 項目の一覧を展開した定義の一覧にする(項目の順、シリーズの中は stages の順)。
 * 鍵の重複は例外: 普通の定義・段階の鍵・シリーズの鍵のどれどうしでも(シリーズをまたいでも)
 */
export function expandMilestoneItems(items: readonly MilestoneItem[]): MilestoneDefinition[] {
  const expanded: MilestoneDefinition[] = [];
  const owners = new Map<string, string>();
  const claim = (key: string, owner: string) => {
    const previous = owners.get(key);
    if (previous !== undefined) {
      throw new Error(`マイルストーンの鍵 "${key}" が複数あります(${previous} と ${owner})。キーが重複しないようにしてください。`);
    }
    owners.set(key, owner);
  };
  for (const item of items) {
    if (isMilestoneSeries(item)) {
      claim(item.key, `シリーズ "${item.key}"`);
      for (const definition of expandSeries(item)) {
        claim(definition.key, `シリーズ "${item.key}" の段階`);
        expanded.push(definition);
      }
    } else {
      claim(item.key, `マイルストーン "${item.key}"`);
      expanded.push(item);
    }
  }
  return expanded;
}

// 呼ぶたびに組む(シリーズの段階は評価のたびに読む)。普通の定義だけでも同じ道を通る(数は小さい)
function registry(): Map<string, MilestoneDefinition> {
  return new Map(expandMilestoneItems(definitions).map((definition) => [definition.key, definition]));
}

/**
 * 指定トリガーに紐づくマイルストーン定義を取得する(シリーズは段階ごとに展開済み)
 *
 * @param trigger トリガー名
 * @returns マイルストーン定義の配列
 */
export function getMilestonesByTrigger(trigger: string): MilestoneDefinition[] {
  return [...registry().values()].filter((d) => d.triggers.includes(trigger));
}

/**
 * 指定キーのマイルストーン定義を取得する(段階の鍵でも引ける)
 *
 * @param key マイルストーンキー
 * @returns マイルストーン定義、未登録の場合は undefined
 */
export function getMilestoneByKey(key: string): MilestoneDefinition | undefined {
  return registry().get(key);
}

/**
 * 登録済みの全マイルストーン定義を取得する(シリーズは段階ごとに展開済み)
 */
export function getAllMilestones(): MilestoneDefinition[] {
  return [...registry().values()];
}

/**
 * シリーズの項目を鍵で取得する(展開しない。進み具合の読み手が stages() を読む)
 *
 * @param seriesKey シリーズの鍵
 * @returns シリーズ、無ければ undefined(普通の定義の鍵でも undefined)
 */
export function getMilestoneSeries(seriesKey: string): MilestoneSeries<unknown> | undefined {
  return definitions.find((item): item is MilestoneSeries<unknown> => isMilestoneSeries(item) && item.key === seriesKey);
}
