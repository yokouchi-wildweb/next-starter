"use client";

import ReactMarkdown from "react-markdown";

import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Link } from "@/components/Navigation/Link";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";

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
    <Section id={section.id} marginBlock="lg">
      <Stack gap="md">
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
                // リンクは棚の Link(文書の中のリンクは閉じた機能でも隠さない = gate always)。外部リンクは新しいタブで開く。href の無い物は文字だけ
                a: ({ href, children }) => {
                  if (!href) return <>{children}</>;
                  const isExternal = href.startsWith("http");
                  return (
                    <Link
                      href={href}
                      gate="always"
                      {...(isExternal && {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                    >
                      {children}
                    </Link>
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
      </Stack>
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
    <Block className={wrapperClassName || undefined}>
      {sections.map((section, index) => (
        <RenderSection
          key={section.id ?? index}
          section={section}
          variables={variables}
        />
      ))}
    </Block>
  );
}
