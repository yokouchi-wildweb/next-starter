// 判定の核: 直接の親との差分(変更の一覧)と、基準側・fork 側の中身から各ファイルを分類する。
// git には触れない純粋関数(差分と中身の取得は呼び出し側)。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「判定」

import { matchIntake } from "./intake.mjs";
import { parseForkRegions, stripOwnedRegions } from "./regions.mjs";

const MARKER_LINE = /fork entries below/;

// reason → verdict。violation 以外はすべて合格
export const REASONS = {
  added: "ok", // fork が足したファイル
  intake: "ok", // 受け口(edit)の中の書き換え
  region: "ok", // fork の区画の中だけの書き換え
  marker: "ok", // 印より下だけの書き換え
  append: "ok", // 基準の中身を先頭に残した追記
  generated: "ok", // 生成物
  "generator-region": "ok", // 生成器の区画の中だけの書き換え(受け口の外のファイルでも)
  deleted: "violation", // 基準にあるファイルの削除
  renamed: "violation", // 基準にあるファイルの rename・移動
  "ancestor-lib-add": "violation", // 祖先 Tier の lib の中へのファイル追加
  "outside-intake": "violation", // 受け口の外の書き換え
  "outside-region": "violation", // fork の区画の外も書き換えた
  "region-markers": "violation", // fork の区画の印が壊れている
  "above-marker": "violation", // 印より上も書き換えた(印が無い)
  "not-append": "violation", // 基準の中身を変えた
  debt: "violation", // upstream の負債の箇所(一時許可で通す)
  "middle-tier": "ok", // 中間 Tier 以下の物(Tier1 の版に無いファイル)の書き換え・削除・rename(D29。check.mjs が付け替える、参考の一覧)
  picked: "ok", // 親の緊急修正を pick しただけの差(台帳の picked:。check.mjs が付け替える)
};

const libNameOf = (path) => {
  const match = /^src\/lib\/([^/]+)\//.exec(path);
  return match ? match[1] : null;
};

const headUntilMarker = (text) => {
  if (text === null) return null;
  const lines = text.split("\n");
  const index = lines.findIndex((line) => MARKER_LINE.test(line));
  return index === -1 ? null : lines.slice(0, index + 1).join("\n");
};

const withoutTrailingNewlines = (text) => text.replace(/\n+$/, "");

function judgeModified(rule, baseText, headText) {
  const kind = rule?.kind ?? null;
  if (kind === "edit") return "intake";
  if (kind === "generated") return "generated";
  if (kind === "debt") return "debt";
  if (kind === "region") {
    if (parseForkRegions(headText).errors.length > 0) return "region-markers";
    return stripOwnedRegions(baseText) === stripOwnedRegions(headText) ? "region" : "outside-region";
  }
  if (kind === "marker") {
    const head = headUntilMarker(headText);
    return head !== null && head === headUntilMarker(baseText) ? "marker" : "above-marker";
  }
  if (kind === "append") {
    return headText.startsWith(withoutTrailingNewlines(baseText)) ? "append" : "not-append";
  }
  return stripOwnedRegions(baseText, { fork: false }) === stripOwnedRegions(headText, { fork: false })
    ? "generator-region"
    : "outside-intake";
}

/**
 * @param {{
 *   changes: { status: string, path: string, from?: string }[],  // git diff --name-status -M <base> HEAD の各行(R は from → path)
 *   baseText: (path: string) => string | null,                   // 基準側の中身(無ければ null)
 *   headText: (path: string) => string | null,                   // fork 側の中身(無ければ null)
 *   baseLibs: Iterable<string>,                                  // 基準の src/lib 直下のディレクトリ名
 *   intake: { kind: string | null, glob: string, exclude: boolean, line: number }[],  // parseIntake(基準側の intake.txt).rules
 * }} input
 * @returns {{ entries: { status: string, path: string, from?: string, kind: string | null, reason: string, verdict: string }[], counts: Record<string, number> }}
 */
export function judge({ changes, baseText, headText, baseLibs, intake }) {
  const libs = new Set(baseLibs);
  const entries = changes.map((change) => {
    const status = change.status[0];
    const rule = matchIntake(intake, change.path);
    let reason;
    if (status === "A") {
      const lib = libNameOf(change.path);
      reason = lib !== null && libs.has(lib) ? "ancestor-lib-add" : "added";
    } else if (status === "D") {
      reason = "deleted";
    } else if (status === "R") {
      reason = "renamed";
    } else {
      reason = judgeModified(rule, baseText(change.path) ?? "", headText(change.path) ?? "");
    }
    return { ...change, status, kind: rule?.kind ?? null, reason, verdict: REASONS[reason] };
  });

  const counts = {};
  for (const entry of entries) counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
  return { entries, counts };
}
