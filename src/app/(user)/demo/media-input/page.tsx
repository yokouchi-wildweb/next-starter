import { Main, PageTitle, Para, SecTitle, Span } from "@/components/TextBlocks";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { MediaPreviewDemo } from "./MediaPreviewDemo";
import { MediaInputDemo } from "./MediaInputDemo";
import { MediaUploadDemo } from "./MediaUploadDemo";
import { MediaUploadMultiDemo } from "./MediaUploadMultiDemo";

export default function MediaInputDemoPage() {
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
            <SecTitle>MediaUpload デモ（モックアップロード）</SecTitle>
            <Para tone="muted" size="sm">
              uploads/demo へアップロードするモック処理で、進捗バーと完了時の URL 表示を確認できます。
            </Para>
            <MediaUploadDemo />
          </Stack>
        </Section>

        <Section>
          <Stack space={4}>
            <SecTitle>MediaUploaderMulti デモ（複数枚アップロード）</SecTitle>
            <Para tone="muted" size="sm">
              複数枚アップロード版。並列アップロード、正方形クロッププレビュー、ドラッグ並び替え、件数上限の動作を確認できます。
            </Para>
            <MediaUploadMultiDemo />
          </Stack>
        </Section>
      </Stack>
    </Main>
  );
}
