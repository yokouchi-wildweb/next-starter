import { Block } from "@/components/Layout/Block";
import { Grid } from "@/components/Layout/Grid";
import { Section } from "@/components/Layout/Section";
import {
  Main,
  PageTitle,
  Para,
  SecTitle,
  Span,
} from "@/components/TextBlocks";
import { appearance } from "@/components/Layout/commonVariants";
import { tone } from "@/components/TextBlocks/textVariants";

import styles from "./page.module.css";

const blockAppearances = Object.keys(appearance) as Array<keyof typeof appearance>;
const paraTones = Object.keys(tone) as Array<keyof typeof tone>;

export default function BlockParaDemoPage() {
  return (
    <Main space="xl" padding="xl" className={styles.pageBackground}>
      <PageTitle>Block と Para のスタイルデモ</PageTitle>
      <Para tone="muted">
        Block コンポーネントの appearance と Para コンポーネントの tone を一覧で比較できます。
      </Para>

      <Section space="lg" className="space-y-6">
        <SecTitle>Block appearance 一覧</SecTitle>
        <Para tone="muted" size="sm">
          各 appearance の見た目と付与されるユーティリティクラスを確認できます。
        </Para>
        <Grid columns="1" gap="lg" className="md:grid-cols-2">
          {blockAppearances.map((appearanceKey) => (
            <Block
              key={appearanceKey}
              appearance={appearanceKey}
              space="sm"
              padding="xl"
              className="min-h-[220px]"
            >
              <Span weight="semiBold" className="tracking-wide uppercase">
                {appearanceKey}
              </Span>
              <Span
                tone="muted"
                size="sm"
                className="font-mono text-xs"
              >
                {appearance[appearanceKey] || "(追加クラスなし)"}
              </Span>
              <Para>
                Block に appearance として {appearanceKey} を設定したサンプルです。余白や影、背景色などの
                スタイルが一目で確認できます。
              </Para>
            </Block>
          ))}
        </Grid>
      </Section>

      <Section space="lg" className="space-y-6">
        <SecTitle>Para tone 一覧</SecTitle>
        <Para tone="muted" size="sm">
          tone ごとの文字色とスタイルを見比べられるように、それぞれの tone 名と適用されるクラスを表示しています。
        </Para>
        <Grid columns="1" gap="md" className="md:grid-cols-2">
          {paraTones.map((toneKey) => (
            <Block
              key={toneKey}
              appearance="surface"
              space="xs"
              padding="lg"
              className="h-full shadow-none ring-1 ring-slate-200/60 dark:ring-slate-700/60"
            >
              <Span weight="semiBold" className="tracking-wide uppercase">
                {toneKey}
              </Span>
              <Span tone="muted" size="sm" className="font-mono text-xs">
                {tone[toneKey] || "(追加クラスなし)"}
              </Span>
              <Para tone={toneKey}>
                このテキストは tone プロップに {toneKey} を渡した Para コンポーネントです。
              </Para>
            </Block>
          ))}
        </Grid>
      </Section>
    </Main>
  );
}
