// cron の段の plan（hobby / pro）を vercel.json の今の crons から推定する（純関数）。plan はどこにも保存されないため。
//   vercel.json が無い = cron の段と cron:check を飛ばす（skip）
//   /api/cron/ のエントリに 1 日 1 回より細かいもの（分か時が数字 1 つでない）がある = pro
//   それ以外 = hobby（タスクが全部 1 日 1 回なら hobby と pro は同じ出力）
//   JSON として読めない = 推定できない（--plan を求めて止める）
// 限界: 有料（pro）でも今のタスクが全部 1 日 1 回なら hobby と区別できない。細かい頻度のタスクを足した最初の forge は
// hobby と推定して 1 日 1 回に落とす（cron:generate が落としたタスクを表示する）→ そのときは --plan pro を付ける
// 「1 日 1 回」の判定は src/lib/cron/cronExpression.ts の isAtMostDailySchedule と同じ（tests/forge.test.mjs が突き合わせる）

const CRON_PATH_PREFIX = "/api/cron/";

/** 分と時が数字 1 つ = 1 日 1 回以下（src/lib/cron/cronExpression.ts と同じ判定。式の妥当性は cron:check が見る） */
export function isAtMostDaily(schedule) {
  const fields = String(schedule).trim().split(/\s+/);
  return fields.length === 5 && /^\d+$/.test(fields[0]) && /^\d+$/.test(fields[1]);
}

/**
 * @param {string | null} vercelJson vercel.json の中身（無ければ null）
 * @returns {{ plan: "hobby" | "pro" | null, reason: string, skip?: boolean, error?: boolean }}
 */
export function inferCronPlan(vercelJson) {
  if (vercelJson === null) return { plan: null, skip: true, reason: "vercel.json が無いので cron の段と cron:check を飛ばします" };
  let config;
  try {
    config = JSON.parse(vercelJson);
  } catch (error) {
    return { plan: null, error: true, reason: `vercel.json を JSON として読めません（${error.message}）。--plan hobby か --plan pro を付けてください` };
  }
  const entries = (Array.isArray(config?.crons) ? config.crons : []).filter((entry) => typeof entry?.path === "string" && entry.path.startsWith(CRON_PATH_PREFIX));
  const frequent = entries.filter((entry) => !isAtMostDaily(entry.schedule));
  if (frequent.length > 0) return { plan: "pro", reason: `1 日 1 回より細かい cron が ${frequent.length} 件あるので pro と推定（例: ${frequent[0].path} ${frequent[0].schedule}）` };
  return { plan: "hobby", reason: `cron が全部 1 日 1 回なので hobby と推定（有料プランなら --plan pro を付けてください）` };
}
