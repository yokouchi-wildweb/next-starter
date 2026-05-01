import type { CSSProperties } from "react";

type BackgroundLayerProps = {
  /** 背景画像のURL */
  readonly imageUrl?: string;
  /** オーバーレイの色（任意のCSS色形式: "#000", "black", "rgb(0,0,0)"など） */
  readonly overlayColor?: string;
  /** オーバーレイの透明度（0-1） */
  readonly overlayOpacity?: number;
};

/**
 * 固定位置の背景レイヤー
 * - 背景画像がある場合: 背景画像 + オーバーレイを表示
 * - 背景画像がない場合: デフォルト背景色（bg-background）を表示
 * - z-index: -1 で最背面に配置し、既存レイアウトに影響しない
 *
 * サイズ指定について（重要・触る前に必読）:
 * モバイルブラウザ（iOS Safari / Chrome Android 等）はスクロール中にアドレス
 * バーの表示・非表示が切り替わり、それに伴って layout viewport の高さが
 * 変動する。`position: fixed; inset: 0` や `100vh` / `100dvh` を使うと、
 * スクロール中にコンテナ高が毎フレーム変わり、`object-fit: cover`
 * （あるいは `background-size: cover`）の倍率再計算が走って画像が
 * カクカクと拡縮して見える。
 *
 * これを根本的に防ぐため、コンテナの高さは `100lvh`（Large Viewport
 * Height = アドレスバーを除いた最大ビューポート高で固定）を使い、
 * スクロール中に絶対にサイズが変動しないようにしている。
 * ここを `100vh` / `100dvh` / `inset: 0` 等に書き換えると拡縮ジッタが
 * 復活するので注意。
 */
export const BackgroundLayer = ({
  imageUrl,
  overlayColor = "#000",
  overlayOpacity = 0,
}: BackgroundLayerProps) => {
  const containerStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100lvh",
    zIndex: -1,
    pointerEvents: "none",
    overflow: "hidden",
  };

  // 背景画像がない場合はデフォルト背景色を使用
  const baseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "hsl(var(--background))",
  };

  const imageStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  };

  const overlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: overlayColor,
    opacity: overlayOpacity,
  };

  return (
    <div style={containerStyle} aria-hidden="true">
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            style={imageStyle}
            decoding="async"
            fetchPriority="high"
          />
          {overlayOpacity > 0 && <div style={overlayStyle} />}
        </>
      ) : (
        <div style={baseStyle} />
      )}
    </div>
  );
};
