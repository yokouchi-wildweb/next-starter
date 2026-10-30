// src/app/(user)/demo/media-input/_screen/DemoMediaInputScreen.tsx
// /demo/media-input(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens/types";
import { Main, PageTitle, Para, SecTitle, Span } from "@/components/TextBlocks";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { MediaPreviewDemo } from "../MediaPreviewDemo";
import { MediaInputDemo } from "../MediaInputDemo";
import { MediaUploadDemo } from "../MediaUploadDemo";
import { MediaUploadMultiDemo } from "../MediaUploadMultiDemo";

import { loadDemoMediaInputScreen } from "./loader";

export async function DemoMediaInputScreen(props: ScreenProps) {
  await loadDemoMediaInputScreen(props);

  return (
    <Main padding="xl">
      <Stack space={6}>
        <PageTitle>MediaInputSuite プレビュー</PageTitle>
        <Para tone="muted" size="sm">
          新しい mediaInputSuite コンポーネントのプレビュー切り替え動作を確認するためのデモページです。
        </Para>

        <Section>
          <Stack space={4}>
            <SecTitle>MediaPreview デモ</SecTitle>
            <Para tone="muted" size="sm">
              ファイルを選択するか URL を入力すると、判別結果に応じて画像・動画・その他のプレビューが切り替わります。
            </Para>
            <MediaPreviewDemo />
          </Stack>
        </Section>

        <Section>
          <Stack space={4}>
            <SecTitle>MediaInput デモ</SecTitle>
            <Para tone="muted" size="sm">
              MediaInput コンポーネントでクリック領域／削除ボタン／ドラッグ＆ドロップの挙動を確認できます。
            </Para>
            <MediaInputDemo />
          </Stack>
        </Section>

        <Section>
          <Stack space={4}>
            <SecTitle>MediaUpload デモ</SecTitle>
            <Para tone="muted" size="sm">
              用途 demo.media（公開・管理者のみアップロード可）へ実際にアップロードし、進捗バーと完了時の値（storage ref）を確認できます。
              デモで上げたファイルは業務データに保存されないため、24 時間ほどで掃除（storage-sweep）により消えます。
            </Para>
            <MediaUploadDemo />
          </Stack>
        </Section>

        <Section>
          <Stack space={4}>
            <SecTitle>MediaUploaderMulti デモ（複数枚アップロード）</SecTitle>
            <Para tone="muted" size="sm">
              複数枚アップロード版。並列アップロード、正方形クロッププレビュー、ドラッグ並び替え、件数上限の動作を確認できます。
              こちらも用途 demo.media へのアップロードで、24 時間ほどで消えます。
            </Para>
            <MediaUploadMultiDemo />
          </Stack>
        </Section>
      </Stack>
    </Main>
  );
}
