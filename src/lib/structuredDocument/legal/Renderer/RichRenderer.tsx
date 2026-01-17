"use client";

import ReactMarkdown from "react-markdown";

import { Section } from "@/components/Layout/Section";
import { Para, SecTitle } from "@/components/TextBlocks";

import type { VariableMap } from "../../shared";
import { replaceVariables } from "../../shared";
import type { LegalSection, LegalSectionNumbering } from "../definition";
import { getNumberingClassName } from "./utils";

type RichRendererProps = {
  sections: LegalSection[];
  variables: VariableMap;
  numbering: LegalSectionNumbering;
};

/**
 * セクションを再帰的にレンダリングする
 */
function RenderSection({
  section,
  variables,
  depth = 0,
}: {
  section: LegalSection;
  variables: VariableMap;
  depth?: number;
}) {
  // 見出しレベルを深さに応じて決定（h2, h3, h4...）
  const headingLevel = Math.min(depth + 2, 6) as 2 | 3 | 4 | 5 | 6;

  return (
    <Section id={section.id} space="sm" marginBlock="lg">
      {section.title && (
        <SecTitle as={`h${headingLevel}`} size={depth === 0 ? "lg" : "md"}>
          {replaceVariables(section.title, variables)}
        </SecTitle>
      )}

      {section.content?.map((text, index) => (
        <Para key={index}>
          <ReactMarkdown
            allowedElements={["p", "a", "strong", "em", "del"]}
            unwrapDisallowed
            components={{
              // p タグは Para 内で不要なので中身だけ返す
              p: ({ children }) => <>{children}</>,
              // リンクは新しいタブで開く（外部リンクの場合）
              a: ({ href, children }) => {
                const isExternal = href?.startsWith("http");
                return (
                  <a
                    href={href}
                    {...(isExternal && {
                      target: "_blank",
                      rel: "noopener noreferrer",
                    })}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {replaceVariables(text, variables)}
          </ReactMarkdown>
        </Para>
      ))}

      {section.children?.map((child, index) => (
        <RenderSection
          key={child.id ?? index}
          section={child}
          variables={variables}
          depth={depth + 1}
        />
      ))}
    </Section>
  );
}

/**
 * リッチモードレンダラー
 * CSSカウンターによる自動採番、Markdown記法のレンダリングに対応
 */
export function RichRenderer({
  sections,
  variables,
  numbering,
}: RichRendererProps) {
  const wrapperClassName = getNumberingClassName(numbering);

  return (
    <div className={wrapperClassName || undefined}>
      {sections.map((section, index) => (
        <RenderSection
          key={section.id ?? index}
          section={section}
          variables={variables}
        />
      ))}
    </div>
  );
}
