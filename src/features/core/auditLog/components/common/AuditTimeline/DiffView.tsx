// src/features/core/auditLog/components/common/AuditTimeline/DiffView.tsx

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";

type DiffType = "added" | "removed" | "changed";

type DiffItem = {
  key: string;
  type: DiffType;
  before: unknown;
  after: unknown;
};

/**
 * トップレベルの key 単位で before / after を比較し、差分のみ抽出する。
 * createCrudService の自動 audit が trackedFields でフィルタ済みのため、
 * 浅い比較で十分なケースを想定（深い比較は recordDiff が事前に計算する）。
 */
function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): DiffItem[] {
  const beforeObj = before ?? {};
  const afterObj = after ?? {};
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const diffs: DiffItem[] = [];

  for (const key of allKeys) {
    const hasBefore = key in beforeObj;
    const hasAfter = key in afterObj;
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];

    if (!hasBefore && hasAfter) {
      diffs.push({ key, type: "added", before: null, after: afterVal });
    } else if (hasBefore && !hasAfter) {
      diffs.push({ key, type: "removed", before: beforeVal, after: null });
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({ key, type: "changed", before: beforeVal, after: afterVal });
    }
  }

  return diffs;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

type Props = {
  before: unknown;
  after: unknown;
};

/**
 * 監査ログの before / after をフィールド単位で比較表示する。
 * AuditTimeline 詳細モーダル内で利用される。
 */
export function DiffView({ before, after }: Props) {
  const diffs = computeDiff(
    before as Record<string, unknown> | null,
    after as Record<string, unknown> | null,
  );

  if (diffs.length === 0) {
    return <Para size="sm" tone="muted">変更なし</Para>;
  }

  return (
    <div className="divide-y divide-border rounded border border-border overflow-hidden">
      {diffs.map((diff) => (
        <Flex
          key={diff.key}
          gap="sm"
          align="center"
          className="px-2 py-1.5 bg-card text-xs"
        >
          <span className="shrink-0 font-medium w-28 truncate" title={diff.key}>
            {diff.key}
          </span>
          <div className="flex-1 min-w-0 truncate">
            {diff.type === "added" ? (
              <span className="text-muted-foreground italic">（なし）</span>
            ) : (
              <code className="rounded bg-muted/50 px-1.5 py-0.5 border border-border">
                {formatValue(diff.before)}
              </code>
            )}
          </div>
          <span className="shrink-0 text-muted-foreground">→</span>
          <div className="flex-1 min-w-0 truncate">
            {diff.type === "removed" ? (
              <span className="text-destructive italic">（削除）</span>
            ) : (
              <code className="rounded bg-muted/50 px-1.5 py-0.5 border border-border">
                {formatValue(diff.after)}
              </code>
            )}
          </div>
        </Flex>
      ))}
    </div>
  );
}
