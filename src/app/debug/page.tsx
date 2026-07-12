// src/app/debug/page.tsx
//
// デバッグ領域のインデックス（雛形）。
// デバッグ用ページはこの階層（src/app/debug/）にディレクトリを追加する。
// 認可は debug/layout.tsx が一括で行う。

import { Main, Stack } from "@/components/Layout";
import { Para, SecTitle } from "@/components/TextBlocks";

export default function DebugIndexPage() {
  return (
    <Main>
      <Stack space={4}>
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
  );
}
