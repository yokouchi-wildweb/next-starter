// src/app/_layout/ScreenWait.default.tsx
//
// 画面の本文の読みを待つ間の既定の表示(createScreen の fallback を省いた時、D106・D107)。上流の既定 = 本文の所だけの部品 PageWait。
// 枠の有無は新しい宣言を足さず、今の枠の root と宣言の印から styles が選ぶ(src/styles/core/frame.css の [data-page-wait]):
// 枠のある画面 = 本文の所だけ(最小の高さ 300px 相当)、枠の無い画面 = 流れの中で画面の高さいっぱい(SSR の最初の HTML から出る)。
// fork は隣に ScreenWait.replace.tsx を作り、1 行スイッチ ./ScreenWait.tsx をそちらへ向けて丸ごと替える(画面ごとは createScreen の fallback)
import { PageWait } from "@/components/Overlays/Loading";

/** 既定の待ちの表示の約束(props なし。画面ごとの違いは createScreen の fallback で渡す) */
export type ScreenWaitProps = Record<string, never>;

export function ScreenWait(_props: ScreenWaitProps) {
  return <PageWait />;
}
