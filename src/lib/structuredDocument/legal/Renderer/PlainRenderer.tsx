import type { VariableMap } from "../../shared";
import { replaceVariables } from "../../shared";
import type { LegalSection, LegalSectionNumbering } from "../definition";
import { formatSectionTitle, stripMarkdown } from "./utils";

type PlainRendererProps = {
  sections: LegalSection[];
  variables: VariableMap;
  numbering: LegalSectionNumbering;
};

/**
 * セクションを再帰的にプレーンテキストでレンダリングする
 */
function RenderSection({
  section,
  variables,
  depth = 0,
  index,
  numbering,
}: {
  section: LegalSection;
  variables: VariableMap;
  depth?: number;
  index: number;
  numbering: LegalSectionNumbering;
}) {
  // トップレベル（depth === 0）のみ番号を付与
  const title = section.title
    ? depth === 0
      ? formatSectionTitle(
          replaceVariables(section.title, variables),
          index,
          numbering
        )
      : replaceVariables(section.title, variables)
    : null;

  return (
    <div style={{ marginBottom: "1rem" }}>
      {title && (
        <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{title}</p>
      )}

      {section.content?.map((text, i) => (
        <p key={i} style={{ marginBottom: "0.5rem" }}>
          {stripMarkdown(replaceVariables(text, variables))}
        </p>
      ))}

      {section.children?.map((child, childIndex) => (
        <RenderSection
          key={child.id ?? childIndex}
          section={child}
          variables={variables}
          depth={depth + 1}
          index={childIndex}
          numbering={numbering}
        />
      ))}
    </div>
  );
}

/**
 * プレーンモードレンダラー
 * Markdown記法を除去し、シンプルなテキストとしてレンダリング
 */
export function PlainRenderer({
  sections,
  variables,
  numbering,
}: PlainRendererProps) {
  return (
    <div>
      {sections.map((section, index) => (
        <RenderSection
          key={section.id ?? index}
          section={section}
          variables={variables}
          index={index}
          numbering={numbering}
        />
      ))}
    </div>
  );
}
