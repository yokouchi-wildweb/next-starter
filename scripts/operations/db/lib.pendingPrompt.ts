// scripts/operations/db/lib.pendingPrompt.ts
//
// pnpm db:push:check の純粋な部品(check-schema-roundtrip.ts は先頭で guard を通すので、テストはここを読む)。
// drizzle-kit の pushSchema は、表・列などが「新しく作るのか、別のものからの改名か」決められないとき、
// 端末で選ぶ問い(hanji の選択)を出して答えを待つ。TTY のない実行(エージェント・CI・< /dev/null)では
// 答えが来ず終わらないので、check は問いの出力を見つけた時点で止まる。読むだけを守るため、答えは決して選ばない。
// - parsePendingPrompt: 出力から問い(何の、どの名前の、どの表の、改名元の候補)を読む
// - findNoticeAnswers: その名前を名指す .notices の行(改名か作成かの答え)を探す
// - formatPendingPrompt: 人と機械が読む止まりの説明

/** drizzle-kit が答えを待っている「作成か改名か」の問い */
export type PendingPrompt = {
  /** 問いの対象の種類(column / table / enum / sequence / view / schema / role / policy など、drizzle-kit の語) */
  entity: string;
  /** 新しい側の名前(列なら列名、表なら schema 付きでないときは表名) */
  name: string;
  /** 列の問いのときの表名 */
  table?: string;
  /** 改名元の候補(DB にあってスキーマにない側) */
  renameFrom: string[];
};

/** 改名か作成かを名指す notice の行 */
export type NoticeAnswer = { id: string; lines: string[] };

// 端末の色や、カーソルの制御(ESC [ … 文字)を外す
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

const COLUMN_QUESTION = /Is (\S+) column in (\S+) table created or renamed from another column\?/;
const NAMED_QUESTION = /Is (\S+) ([a-z]+(?: [a-z]+)*) created or renamed from another \2\?/;
// 選択肢の行: "~ old › new  rename column"(改名) / "+ new  create column"(作成)。先頭の ❯ は選ばれている印
const RENAME_OPTION = /~ (\S+) › (\S+)\s+rename [a-z ]+$/;

/** drizzle-kit の出力(色付きのまま)から、答えを待っている問いを読む。問いがなければ null */
export const parsePendingPrompt = (output: string): PendingPrompt | null => {
  const text = output.replace(ANSI, "");
  const column = COLUMN_QUESTION.exec(text);
  const named = column ? null : NAMED_QUESTION.exec(text);
  if (!column && !named) return null;
  const match = (column ?? named) as RegExpExecArray;
  const renameFrom = text
    .slice(match.index + match[0].length)
    .split("\n")
    .map((line) => RENAME_OPTION.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1]);
  return column
    ? { entity: "column", name: column[1], table: column[2], renameFrom }
    : { entity: (named as RegExpExecArray)[2], name: (named as RegExpExecArray)[1], renameFrom };
};

const EXCERPT = 160;

/** 長い行(notice の change: など)は、最初に名前(なければ drizzle-kit)が出る所の前後だけにする */
const excerpt = (line: string, names: readonly string[]): string => {
  if (line.length <= EXCERPT * 2) return line;
  const hits = [...names, "drizzle-kit"].map((n) => line.indexOf(n)).filter((i) => i >= 0);
  const at = hits.length > 0 ? Math.min(...hits) : 0;
  const start = Math.max(0, at - EXCERPT / 2);
  const end = Math.min(line.length, at + EXCERPT * 1.5);
  return `${start > 0 ? "…" : ""}${line.slice(start, end)}${end < line.length ? "…" : ""}`;
};

/**
 * 問いの名前を名指す notice の行を探す。
 * notice は散文なので、名前(列なら表名も)を本文に含む notice のうち、改名に触れる行(rename / 改名 / drizzle-kit)で
 * 名前か drizzle-kit を含む行を返す(長い行は名前の前後だけ)。
 */
export const findNoticeAnswers = (
  prompt: PendingPrompt,
  notices: readonly { id: string; text: string }[],
): NoticeAnswer[] => {
  const names = [prompt.name, ...prompt.renameFrom];
  return notices
    .filter(({ text }) => text.includes(prompt.name) && (!prompt.table || text.includes(prompt.table)))
    .map(({ id, text }) => ({
      id,
      lines: text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /rename|改名|drizzle-kit/i.test(line) && (names.some((n) => line.includes(n)) || /drizzle-kit/i.test(line)))
        .map((line) => excerpt(line, names)),
    }))
    .filter((answer) => answer.lines.length > 0);
};

/** 止まった理由と、決める人がすること(読むだけなので答えはしない) */
export const formatPendingPrompt = (prompt: PendingPrompt, answers: readonly NoticeAnswer[]): string => {
  const target = prompt.table ? `${prompt.table}.${prompt.name}` : prompt.name;
  const lines = [
    "",
    `止まりました: drizzle-kit が「${prompt.entity} ${target} は新しく作るのか、別の ${prompt.entity} からの改名か」の答えを待っています。`,
    prompt.renameFrom.length > 0
      ? `改名元の候補: ${prompt.renameFrom.join(", ")}`
      : "改名元の候補: (出力から読めませんでした)",
    "TTY のない実行では答えられないため、読むだけの確認はここで終わります(答えは選びません)。",
    "決め方: 端末で pnpm db:push を実行して作成か改名かを選ぶ(その後 pnpm db:push:check で差分ゼロを確かめる)。",
  ];
  if (answers.length > 0) {
    lines.push("この名前を名指す notice の答え:");
    for (const answer of answers) {
      lines.push(`  .notices/${answer.id}.md`);
      for (const line of answer.lines) lines.push(`    ${line}`);
    }
  }
  return lines.join("\n");
};
