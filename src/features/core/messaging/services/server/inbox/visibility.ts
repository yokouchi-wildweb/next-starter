// src/features/core/messaging/services/server/inbox/visibility.ts
//
// 受け取り箱の「見える行」の規則(D32・D35)。利用者の API の読み手は全部これを通る(規則を変える時はここだけ)。
// - 公開の時刻 ≤ 今
// - 自分宛ての行(user_id = 見る人)か、共有の行(user_id null で target_roles が null = 全員 か 見る人のロールを含む)
// - 共有の行: 回の show_to_later_signups が false なら、見る人の登録(users.created_at)より前に公開された行は見せない
//   (利用者の行が無い時は見せない = fail-closed)
// - 共有の行: 好みに従う回(種別の性質 userStoppable、kind の無い前の回も)で、見る人が inApp か '*' の経路で回の種類か '*' を止めていれば見せない
//   (共有の行は書く時に好みを当てないので、読む時に当てる)
// 取り下げた回の行は消えているので、ここで外す物は無い

import { sql, type SQL } from "drizzle-orm";

import { kindTraits, kindsWhere } from "@/lib/messaging";

import { UserTable } from "@/features/core/user/entities/drizzle";

import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable } from "../../../entities/inbox";
import { MessagePreferenceTable } from "../../../entities/preference";
import { MESSAGE_ALL } from "../../../entities/schema";

/** 見る人(createMeRoute の ctx.user) */
export type InboxViewer = { userId: string; role: string };

const IN_APP = "inApp";
/** 共有の行で利用者の好み(お知らせの停止)に従う種別 = 性質 userStoppable。kind の無い前の回も従う(今までどおり) */
const STOPPABLE_KINDS = kindsWhere((traits) => traits.userStoppable);

/** 見える行の WHERE(message_inbox_items と message_dispatches を JOIN した問い合わせで使う) */
export function inboxVisibilitySql(viewer: InboxViewer): SQL {
  const I = MessageInboxItemTable;
  const D = MessageDispatchTable;
  const P = MessagePreferenceTable;
  return sql`(
    ${I.published_at} <= now()
    AND (
      ${I.user_id} = ${viewer.userId}
      OR (
        ${I.user_id} IS NULL
        AND (${I.target_roles} IS NULL OR ${viewer.role} = ANY(${I.target_roles}))
        AND (
          ${D.show_to_later_signups}
          OR ${I.published_at} >= (SELECT ${UserTable.createdAt} FROM ${UserTable} WHERE ${UserTable.id} = ${viewer.userId})
        )
        AND NOT (
          (${D.kind} IS NULL OR ${D.kind} IN (${sql.join(STOPPABLE_KINDS.map((kind) => sql`${kind}`), sql`, `)}))
          AND EXISTS (
            SELECT 1 FROM ${P}
            WHERE ${P.user_id} = ${viewer.userId}
              AND ${P.channel} IN (${IN_APP}, ${MESSAGE_ALL})
              AND (${P.category} = ${MESSAGE_ALL} OR ${P.category} = ${D.category})
          )
        )
      )
    )
  )`;
}

/** 規則の写し(単体テストとメモリの store が使う。SQL と同じ判定) */
export type VisibilityFacts = {
  viewer: InboxViewer & { createdAt: Date | null; optOuts: readonly { category: string; channel: string }[] };
  item: { userId: string | null; targetRoles: readonly string[] | null; publishedAt: Date };
  dispatch: { showToLaterSignups: boolean; kind: string | null; category: string | null };
  now: Date;
};

export function isVisible({ viewer, item, dispatch, now }: VisibilityFacts): boolean {
  if (item.publishedAt > now) return false;
  if (item.userId !== null) return item.userId === viewer.userId;
  if (item.targetRoles !== null && !item.targetRoles.includes(viewer.role)) return false;
  if (!dispatch.showToLaterSignups) {
    if (!viewer.createdAt || item.publishedAt < viewer.createdAt) return false;
  }
  if (dispatch.kind === null || kindTraits(dispatch.kind)?.userStoppable) {
    const stopped = viewer.optOuts.some(
      (row) =>
        (row.channel === IN_APP || row.channel === MESSAGE_ALL) &&
        (row.category === MESSAGE_ALL || row.category === dispatch.category),
    );
    if (stopped) return false;
  }
  return true;
}
