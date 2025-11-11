# Tailwind CSS v4 + Next.js 15 カスタムCSS定義マニュアル

## 🎯 目的

このマニュアルは、Tailwind CSS v4 環境において以下のようなカスタムスタイルを追加する方法を説明します：

- 独自のカラー、フォント、ブレークポイントなど
- アニメーション・キーフレーム
- 任意の `@layer` によるカスタムスタイル
- スタイルファイルの構成と分離方法

---

## 🧱 ディレクトリ構成（推奨）

```
src/
├─ styles/
│  ├─ global.css           ← Tailwindのベースと入口
│  ├─ theme.css            ← カラー、フォントなどのカスタムテーマ
│  ├─ animations.css       ← アニメーション定義
│  ├─ base.css             ← @layer base を担当
│  ├─ components.css       ← @layer components を担当
│  └─ utilities.css        ← @layer utilities を担当
```

---

## 📄 global.css の書き方

```css
@import "../../../node_modules/tailwindcss/dist/lib.d.mts";
@import "../../../node_modules/tw-animate-css";

@import "./animations.css";
@import "./theme.css";
@import "./base.css";
@import "./components.css";
@import "./utilities.css";
@import "./admin.css";
```

---

## 🎨 カスタムテーマ追加（theme.css）

```css
@theme {
  colors: {
    brand: {
      light: #93c5fd;
      default: #3b82f6;
      dark: #1e3a8a;
    }
  }

  fontFamily: {
    sans:
      [ "Inter",
      "ui-sans-serif",
      "system-ui"];
    heading:
      [ "Oswald",
      "sans-serif"];
  }

  screens: {
    xs: "480px";
    xxl: "1600px";
  }
}
```

> Tailwind の読み込みは `global.css` に集約しているため、ここでの `@import "tailwindcss"` は不要です。

---

## 🎞 カスタムアニメーション（animations.css）

```css
@theme {
  --animate-fade-in: fade-in 0.5s ease-in-out;

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}
```

> 💡 **`--animate-*` を定義することで Tailwind に「このアニメーションは使用中」と認識させることができ、`@keyframes` がビルド結果に含まれます。これを定義しないとアニメーションが削除される可能性があります。**

| 設定            | 例                                      | 解説                                |
| --------------- | --------------------------------------- | ----------------------------------- |
| name            | `fade-in`                               | `@keyframes` の名前                 |
| duration        | `0.5s`, `300ms`                         | アニメーション時間                  |
| timing-function | `ease`, `linear`, `ease-in-out` など    | イージング                          |
| delay           | `0.2s`                                  | 開始の遅延                          |
| iteration-count | `infinite`, `1`, `3`                    | 繰り返し回数                        |
| direction       | `normal`, `alternate`                   | 再生方向                            |
| fill-mode       | `forwards`, `backwards`, `both`, `none` | 終了後の状態保持                    |
| play-state      | `running`, `paused`                     | 再生/一時停止状態（あまり使わない） |

---

## 🧩 カスタムLayer定義（base.css / components.css / utilities.css）

`@layer` ごとの責務に応じて 3 ファイルへ分割し、それぞれで必要なスタイルのみを管理します。

```css
/* base.css */
@layer base {
  html {
    font-family: theme("fontFamily.sans");
    background-color: theme("colors.gray.50");
  }
}

/* components.css */
@layer components {
  .btn {
    @apply px-4 py-2 rounded text-white bg-brand;
  }
}

/* utilities.css */
@layer utilities {
  .text-shadow {
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }
}
```

---

## 💡 その他のヒント

- ファイルを `.css` に統一して分離管理することで保守性が向上
- `@theme` は Tailwind v4 のみの機能、従来の `tailwind.config.js` に依存しない
- `@layer` は従来のTailwind構文と完全互換なので柔軟に併用可能
- ShadCNやUIライブラリと併用時は `@layer base` の影響に注意

---

## 🚀 コンポーネントへのスタイル運用

- UI実装は **shadcn/ui** を基点にし、生成したコンポーネントは `components/Shadcn/` にまとめます
- 新しいUIを作るときも `cva()` を用いてTailwindクラスをバリアント化し、`className` へ直接記述しないこと
- `global.css` には読み込みのみを書き、追加スタイルは `theme.css`、`animations.css`、`base.css`、`components.css`、`utilities.css` に分割して管理します
- 共通UIのスタイルはバリアントで一元化して、修正時の影響範囲を最小限に抑えましょう

---

## ✅ まとめ

| スタイルタイプ                   | 記述場所         | 推奨形式                           |
| -------------------------------- | ---------------- | ---------------------------------- |
| カラー/フォント/ブレークポイント | `theme.css`      | `@theme`                           |
| アニメーション                   | `animations.css` | `--animate-*` + `@keyframes`       |
| カスタムCSS                      | `base.css` / `components.css` / `utilities.css` | `@layer base/components/utilities` |
| Tailwind読み込み                 | `global.css`     | `@import`で結合                    |

---
