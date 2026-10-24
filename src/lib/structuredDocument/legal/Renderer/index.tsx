"use client";

import { Para } from "@/components/TextBlocks";

import type { LegalDocumentRendererProps, LegalEnactedAtFormat } from "../definition";
import { PlainRenderer } from "./PlainRenderer";
import { RichRenderer } from "./RichRenderer";

const DEFAULT_ENACTED_AT_FORMAT: Required<LegalEnactedAtFormat> = {
  both: "制定日：{enactedAt} / 最終改定日：{lastUpdatedAt}",
  enactedOnly: "【{enactedAt}制定】",
  updatedOnly: "最終改定日：{lastUpdatedAt}",
};

function formatEnactedAtLine(
  enactedAt: string | undefined,
  lastUpdatedAt: string | undefined,
  format: LegalEnactedAtFormat | undefined,
): string | null {
  const resolved = { ...DEFAULT_ENACTED_AT_FORMAT, ...format };
  const template = enactedAt && lastUpdatedAt
    ? resolved.both
    : enactedAt
      ? resolved.enactedOnly
      : lastUpdatedAt
        ? resolved.updatedOnly
        : null;
  if (template === null) return null;
  return template
    .replaceAll("{enactedAt}", enactedAt ?? "")
    .replaceAll("{lastUpdatedAt}", lastUpdatedAt ?? "");
}

/**
 * リーガルドキュメントレンダラー
 *
 * @example
 * // リッチモード（デフォルト）
 * <LegalDocumentRenderer
 *   document={termsConfig}
 *   variables={{ COMPANY_NAME: "株式会社Example" }}
 * />
 *
 * @example
 * // プレーンモード（スクロール領域での表示など）
 * <LegalDocumentRenderer
 *   document={termsConfig}
 *   variables={variables}
 *   mode="plain"
 *   maxHeight="300px"
 *   showTitle={false}
 * />
 */
export function LegalDocumentRenderer({
  document,
  mode = "rich",
  variables = {},
  showTitle = true,
  showEnactedAt = true,
  enactedAtFormat,
  maxHeight,
  className,
}: LegalDocumentRendererProps) {
  const numbering = document.sectionNumbering ?? "none";
  const enactedAtLine = showEnactedAt
    ? formatEnactedAtLine(document.enactedAt, document.lastUpdatedAt, enactedAtFormat)
    : null;

  const content = (
    <>
      {mode === "rich" ? (
        <RichRenderer
          sections={document.sections}
          variables={variables}
          numbering={numbering}
        />
      ) : (
        <PlainRenderer
          sections={document.sections}
          variables={variables}
          numbering={numbering}
        />
      )}

      {/* 制定日・最終更新日 */}
      {enactedAtLine && (
        <Para tone="muted" size="sm">
          {enactedAtLine}
        </Para>
      )}
    </>
  );

  // スクロール領域として表示する場合
  if (maxHeight) {
    return (
      <div
        className={className}
        style={{
          maxHeight,
          overflowY: "auto",
          padding: "1rem",
          border: "1px solid var(--color-border, #e5e7eb)",
          borderRadius: "0.5rem",
        }}
      >
        {showTitle && (
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              marginBottom: "1rem",
            }}
          >
            {document.title}
          </h2>
        )}
        {content}
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}
