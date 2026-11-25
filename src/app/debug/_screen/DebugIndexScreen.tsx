// src/app/debug/_screen/DebugIndexScreen.tsx
//
// デバッグ領域のインデックス（雛形）。
// デバッグ用ページはこの階層（src/app/debug/）にディレクトリを追加する。
// 認可は debug/layout.tsx が一括で行う。

import { Main } from "@/components/Layout/Main";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { createScreen } from "@/wiring/screen";

import { loadDebugIndexScreen } from "./loader";

export const { Screen: DebugIndexScreen, generateMetadata } = createScreen({
  load: loadDebugIndexScreen,
  render: () => (
    <Main>
      <Stack gap="md">
        <SecTitle>デバッグツール</SecTitle>
        <Para>
          この領域（/debug/**）は管理者カテゴリ + デバッガーロールのみアクセスできます。
          デバッグ用ページは src/app/debug/ 配下に追加してください（ガードは layout が一括適用）。
        </Para>
        <Para>
          API 側の雛形は GET /api/debug/ping（src/app/api/debug/ping/route.ts）を参照。
        </Para>
      </Stack>
    </Main>
  ),
});
