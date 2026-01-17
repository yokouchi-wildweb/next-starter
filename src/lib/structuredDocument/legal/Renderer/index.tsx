"use client";

import { Para } from "@/components/TextBlocks";

import type { LegalDocumentRendererProps } from "../definition";
import { PlainRenderer } from "./PlainRenderer";
import { RichRenderer } from "./RichRenderer";

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
  maxHeight,
  className,
}: LegalDocumentRendererProps) {
  const numbering = document.sectionNumbering ?? "none";

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

      {/* 制定日 */}
      {showEnactedAt && document.enactedAt && (
        <Para tone="muted" size="sm">
          【{document.enactedAt}制定】
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
