// scripts/operations/data/lib.jsonl.ts
// pnpm ops data のファイルの形 = JSON Lines(1 行 1 件、AMENDMENT 1 = a)。
// JSON に無い型は印を付けて往復させる: Date → { "$date": "<ISO>" }(読む時に Date に戻す)。配列・jsonb・null・数値・真偽はそのまま。
// 空行は飛ばす。読めない行は行番号つきで全部並べて止める。

export type JsonRecord = Record<string, unknown>;

const DATE_TAG = "$date";

/** 書く: Date を印に(入れ子も) */
function encode(value: unknown): unknown {
  if (value instanceof Date) return { [DATE_TAG]: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

/** 読む: 印を Date に(入れ子も) */
function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1 && entries[0][0] === DATE_TAG && typeof entries[0][1] === "string") return new Date(entries[0][1]);
    return Object.fromEntries(entries.map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

export const toJsonLine = (record: JsonRecord): string => JSON.stringify(encode(record));

/** ファイルの中身を読む。誤りは行番号つきで throw(何もしていない) */
export function parseJsonLines(text: string): JsonRecord[] {
  const out: JsonRecord[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      const value = decode(JSON.parse(line));
      if (!value || typeof value !== "object" || Array.isArray(value)) problems.push(`${index + 1} 行目: 1 行 1 件のオブジェクトではありません`);
      else out.push(value as JsonRecord);
    } catch (error) {
      problems.push(`${index + 1} 行目: JSON として読めません(${error instanceof Error ? error.message : String(error)})`);
    }
  });
  if (problems.length > 0) throw new Error(problems.slice(0, 20).join("\n") + (problems.length > 20 ? `\nほか ${problems.length - 20} 行` : ""));
  return out;
}
