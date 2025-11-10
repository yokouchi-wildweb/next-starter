import fs from 'fs';
import path from 'path';
import { toKebabCase } from '../../../../src/utils/stringCase.mjs';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 管理画面のメニューに項目を追加する
export default function updateAdminDataMenu({ rootDir, plural, label }) {
  const menuPath = path.join(rootDir, 'src', 'registry', 'adminDataMenu.ts');
  // メニュー定義ファイルが無ければ何もしない
  if (!fs.existsSync(menuPath)) return;
  const lines = fs.readFileSync(menuPath, 'utf8').trimEnd().split(/\r?\n/);
  const marker = lines.findIndex((l) => l.includes('// --- AUTO-GENERATED-END ---'));
  const insertIndex = marker !== -1 ? marker : lines.length - 1;
  const href = `/admin/${toKebabCase(plural)}`;
  const newLine = `  { title: "${label}", href: "${href}" },`;
  const hrefPattern = new RegExp(`href:\\s*["']${escapeRegExp(href)}["']`);
  // 既に同じ href が存在する場合は追加しない
  if (lines.some((line) => hrefPattern.test(line))) {
    console.log(`スキップしました（既に存在）: ${menuPath}`);
    return;
  }
  lines.splice(insertIndex, 0, newLine);
  fs.writeFileSync(menuPath, lines.join('\n') + '\n');
  console.log(`更新しました: ${menuPath}`);
}
