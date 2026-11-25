// src/lib/screens/createScreen.tsx
//
// 画面の作り手(D110)。画面は createScreen({ load, render, fallback?, metadata? }) 1 つで書く:
// - Screen(props) = 境界(Suspense)の内側の部品が load(props) を待ってから render(data, props) を返す。
//   見出しを含む本文は load(範囲とページの確かめ)が解けてからだけ描かれ、作り手の外には何も描かない
// - generateMetadata(props) = 題名も load の後だけ。metadata を省くと load を呼ばずに空(範囲の layout の guardMetadata が先に守る)
// - load の redirect / notFound はそのまま投げる(本文も題名も返さない)
// 既定の fallback は lib が src/app を読めないので結び目(src/wiring/screen.tsx)が渡す。手順と規則: ./README.md

import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";

import type { ScreenProps } from "./types";

/** 題名: 値(load を通してから返す)か、load の結果から作る関数 */
export type ScreenMetadata<TData, TProps> =
  | Metadata
  | ((data: TData, props: TProps) => Metadata | Promise<Metadata>);

export type ScreenConfig<TProps, TData> = {
  /** 範囲とページの確かめと読み(最寄りの guard.ts の createLoader の loader) */
  readonly load: (props: TProps) => Promise<TData>;
  /** load の後にだけ呼ばれる本文(見出しを含む) */
  readonly render: (data: TData, props: TProps) => ReactNode | Promise<ReactNode>;
  /** load を待つ間の表示。省略 = 結び目の既定(src/app/_layout/ScreenWait) */
  readonly fallback?: ReactNode;
  /** 省略 = 空の題名(load を呼ばない) */
  readonly metadata?: ScreenMetadata<TData, TProps>;
};

export type ScreenMakerConfig = {
  /** fallback を省いた画面の待つ間の表示 */
  readonly defaultFallback: ReactNode;
};

export type CreatedScreen<TProps> = {
  /** page.tsx の default export にする部品 */
  readonly Screen: (props: TProps) => ReactNode;
  /** page.tsx が再 export する題名の関数 */
  readonly generateMetadata: (props: TProps) => Promise<Metadata>;
};

export type CreateScreen = <TProps extends object = ScreenProps, TData = void>(
  config: ScreenConfig<TProps, TData>,
) => CreatedScreen<TProps>;

/** 既定の fallback を結んだ作り手を作る(結び目 src/wiring/screen.tsx だけが呼ぶ) */
export function createScreenMaker({ defaultFallback }: ScreenMakerConfig): CreateScreen {
  return function createScreen<TProps extends object = ScreenProps, TData = void>(
    config: ScreenConfig<TProps, TData>,
  ): CreatedScreen<TProps> {
    async function ScreenBody({ screenProps }: { readonly screenProps: TProps }) {
      const data = await config.load(screenProps);
      return <>{await config.render(data, screenProps)}</>;
    }

    function Screen(props: TProps) {
      return (
        <Suspense fallback={config.fallback ?? defaultFallback}>
          <ScreenBody screenProps={props} />
        </Suspense>
      );
    }

    async function generateMetadata(props: TProps): Promise<Metadata> {
      const { metadata } = config;
      if (metadata === undefined) return {};
      const data = await config.load(props);
      return typeof metadata === "function" ? metadata(data, props) : metadata;
    }

    return { Screen, generateMetadata };
  };
}
