// src/domains/core/userGroup/types/criterion.ts
// 条件の部品(点 userGroupCriteria の項目、D103)の型。部品は users への SQL の述語だけを返す(id を集める関数の部品は置かない)。
// SQL で書けない条件は静的グループへ書く上流の口(予算つきの置き換え・足す)を fork の task / cron が使い、
// 動的からは「この静的グループの一員」の部品で使う

import type { SQL } from "drizzle-orm";
import type { z } from "zod";

import type { FieldConfig } from "@/lib/formSuite";
import type { InlineFieldGroup } from "@/lib/formSuite";

/** where に渡す文脈(評価の時刻。同じ評価の中では全部の部品が同じ時刻を見る) */
export type UserGroupCriterionContext = { now: Date };

/**
 * 条件の部品(<ドメイン>/plugs/userGroupCriteria/<名前>.ts の export const criterion)。
 * - key: 定義の木の葉 { part: key, args } が指す鍵(一意)
 * - args: 引数の zod(定義を保存する時・評価する時に通す。誤りは DomainError)
 * - fields: 管理画面の条件の欄(フォームの欄の型。name = args の鍵)
 * - inlineGroups: 欄を横に 1 行で並べる組(任意、D90。FieldRenderer の InlineFieldGroup の形: key・label・fields = 欄の name・fieldWidths?)
 * - weight: cheap = 1 人の確かめ・その場の評価に使える / heavy = 重い(含む動的グループは 1 人の確かめを拒み、定期計算にすれば使える)
 * - where: users の行への SQL の述語(users の列を読む。他の表は EXISTS の副問い合わせで)
 * - enabled: false = 使わない(fork は上流の部品の隣の <名前>.override.ts で enabled・label・description を変えられる。
 *   inStaticGroup は止められない = 例外の人と静的グループの条件が使う)
 * - available: 部品が読む機能が開いているか(例: 購入金額の合計は門 payment)。false の間は部品の一覧に無い(呼ぶたびに読む)
 */
export type UserGroupCriterion<Args extends z.ZodTypeAny = z.ZodTypeAny> = {
  key: string;
  label: string;
  description?: string;
  args: Args;
  fields: readonly FieldConfig[];
  inlineGroups?: readonly InlineFieldGroup[];
  weight: "cheap" | "heavy";
  enabled?: boolean;
  available?: () => boolean;
  // メソッドの書き方(引数の型が項目ごとに違っても一覧 Record<string, UserGroupCriterion> に入る)
  where(args: z.infer<Args>, ctx: UserGroupCriterionContext): SQL;
};
