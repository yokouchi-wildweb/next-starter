// scripts/operations/legal/lib.ts — 法務の文書の初期化の道具の部品(pnpm ops legal from-example)
// 上書き src/config/features/legal.config.ts を今の値から書き直す: 選んだ文書を例文の写しで own にし、他のキー(paymentMethods・licenses など)は残す。
// 値はリテラルで書く(上書きの lint config-overrides/literal-only)。ファイルの注記は決まった頭に戻る(手で書いた注記は残らない)

import type { LegalDocument } from "@/lib/structuredDocument/legal";
import type { LegalDocumentKind } from "@/features/core/legal";

export const LEGAL_OVERRIDE_FILE = "src/config/features/legal.config.ts";

const HEADER = `// src/config/features/legal.config.ts
// 法務の文書の設定の上書き(持ち主 src/features/core/legal/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// own の文書 = このプロジェクトの文面(例文は src/features/core/legal/examples/、変更履歴は examples/CHANGELOG.md)。形: src/features/core/legal/README.md
import type { LegalOverride } from "@/features/core/legal/config";
`;

type OverrideValue = Record<string, unknown> & { documents?: Partial<Record<LegalDocumentKind, { source: string }>> };

/** 上書きの本文(リテラル) */
export function overrideFileText(value: OverrideValue): string {
  const body = JSON.stringify(value, null, 2).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, "$1$2:");
  return `${HEADER}\nexport default ${body} satisfies LegalOverride;\n`;
}

/**
 * 選んだ文書を例文の写しで own にした上書きの値。既に own の文書は force でない限り変えず、理由を返す
 * @param current 今の上書きの値(export default)
 */
export function withExamples(
  current: OverrideValue,
  kinds: readonly LegalDocumentKind[],
  examples: Record<LegalDocumentKind, LegalDocument>,
  force: boolean,
): { value: OverrideValue; written: LegalDocumentKind[]; skipped: string[] } {
  const documents = { ...(current.documents ?? {}) } as Record<string, unknown>;
  const written: LegalDocumentKind[] = [];
  const skipped: string[] = [];
  for (const kind of kinds) {
    const entry = documents[kind] as { source?: string } | undefined;
    if (entry?.source === "own" && !force) {
      skipped.push(`${kind} は既に source: "own" です(例文で上書きするなら --force)`);
      continue;
    }
    documents[kind] = { source: "own", document: structuredClone(examples[kind]) };
    written.push(kind);
  }
  return { value: { ...current, documents }, written, skipped };
}
