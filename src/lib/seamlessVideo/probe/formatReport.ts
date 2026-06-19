// src/lib/seamlessVideo/probe/formatReport.ts
//
// 検証レポート(ValidationReport / ReelValidationReport)を人間可読な文字列配列へ整形するヘルパー。
// UI でそのままリスト表示したり、join("\n") してログ/トーストに出したりできる。
// 表示の都合に依存しない素朴な整形のみを行い、装飾(色・アイコン)は呼び出し側に委ねる。

import type { ValidationReport } from "./validateFragments";
import type { ReelValidationReport } from "./validateReel";

function fmtSec(s: number | null | undefined): string {
  return s == null ? "—" : `${s.toFixed(2)}s`;
}

function statusLabel(issues: string[], warnings: string[]): string {
  if (issues.length > 0) return "NG";
  if (warnings.length > 0) return "警告";
  return "OK";
}

/** 映像のみセットの検証レポートを文字列配列へ整形する(validateFragments の結果)。 */
export function formatValidationReport(report: ValidationReport): string[] {
  const lines: string[] = [];
  lines.push(report.ok ? "✓ 連結成立の見込みあり" : "✗ 問題あり");
  if (report.mimeType) {
    lines.push(`コーデック: ${report.mimeType} / 再生可否: ${report.supported ? "可" : "不可"}`);
  }
  for (const e of report.errors) lines.push(`エラー: ${e}`);
  for (const w of report.warnings) lines.push(`警告: ${w}`);

  report.fragments.forEach((f, i) => {
    const info = f.info;
    const meta = info
      ? ` ${info.codec ?? "codec不明"} / ${info.width ?? "?"}×${info.height ?? "?"} / ${fmtSec(info.durationSec)}`
      : "";
    lines.push(`#${i + 1} ${f.name} [${statusLabel(f.issues, f.warnings)}]${meta}`);
    for (const m of f.issues) lines.push(`  - ${m}`);
    for (const m of f.warnings) lines.push(`  - (警告) ${m}`);
  });

  return lines;
}

/** 映像+音声リールの検証レポートを文字列配列へ整形する(validateReel の結果)。 */
export function formatReelValidationReport(report: ReelValidationReport): string[] {
  const lines: string[] = [];
  lines.push(report.ok ? "✓ 連結成立の見込みあり" : "✗ 問題あり");
  lines.push(
    `音声連結: ${report.hasAudioAll ? "全フラグメントに音声あり(有効)" : "無効(映像のみ)"}` +
      (report.mimeType ? ` / 映像: ${report.mimeType}` : ""),
  );
  for (const e of report.errors) lines.push(`エラー: ${e}`);
  for (const w of report.warnings) lines.push(`警告: ${w}`);

  report.fragments.forEach((f, i) => {
    const info = f.videoInfo;
    const meta = info ? ` ${info.codec ?? "codec不明"} / ${info.width ?? "?"}×${info.height ?? "?"}` : "";
    const dur = `映像尺 ${fmtSec(f.videoDurationSec)} / 音声尺 ${fmtSec(f.audioDurationSec)}`;
    lines.push(`#${i + 1} ${f.name} [${statusLabel(f.issues, f.warnings)}]${meta} / ${dur}`);
    for (const m of f.issues) lines.push(`  - ${m}`);
    for (const m of f.warnings) lines.push(`  - (警告) ${m}`);
  });

  return lines;
}
