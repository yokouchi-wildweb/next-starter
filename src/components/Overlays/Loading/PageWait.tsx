// src/components/Overlays/Loading/PageWait.tsx
//
// 本文の所だけに出す待ちの表示(画面の本文の読みを待つ間、D101・D103): 流れの中・覆う層なし・背景なし・色は親(範囲の枠)から継ぐ。
// 高さは styles が決める(src/styles/core/frame.css の [data-page-wait]): 枠のある画面 = 最小の高さ --page-wait-min-height(300px 相当)、
// 枠の無い画面(枠の root が無い・fill・部位を全部隠す)= --page-wait-frameless-height(画面の高さ、D107)。文字を持たない(殻に入る)。
// 表示を遅らせる仕組みは持たない(D109)
import { Spinner, type SpinnerVariant } from "./Spinner";
import { cn } from "@/lib/cn";

export type PageWaitProps = {
  /** 外側に足すクラス */
  className?: string;
  /** Spinner に足すクラス(大きさ。色は親から継ぐ) */
  spinnerClassName?: string;
  /** Spinner の形 */
  spinnerVariant?: SpinnerVariant;
};

export function PageWait({ className, spinnerClassName, spinnerVariant }: PageWaitProps) {
  return (
    <div
      data-page-wait=""
      className={cn("flex w-full items-center justify-center", className)}
      role="status"
      aria-busy
    >
      <Spinner className={cn("size-8 text-current", spinnerClassName)} variant={spinnerVariant} />
    </div>
  );
}
