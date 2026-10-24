# HeaderCustom

> **廃止予定**: config の部品切り替え(HeaderCustom / FooterCustom)は旧来の方式で、旧入口撤去の区切りで削除します。新しく差し替えるときは、`src/app/(user)/_layout/UserLayout.<project>.tsx`(ドット区切り名のカスタム)で既定の `UserLayout` に `header` / `footer` slot として自分の部品を渡し、`src/app/(user)/layout.tsx` をそちらへ向けます。手順: [src/app/(user)/_layout/README.md](../../../../../app/(user)/_layout/README.md)「layout.tsx と slot」。それまでは下の切り替えも動きます(UserLayout は slot 省略時に config の部品を描く)。

カスタマイズ用のヘッダーコンポーネント。`Header/` のコピーであり、自由に編集可能。

## ディレクトリ構成

```
HeaderCustom/
├── index.tsx          # エントリーポイント（スロット配置を編集）
├── HeaderShell.tsx    # レイアウト（left/center/right スロット）
├── Brand.tsx          # ロゴ・ブランド表示
├── types.ts           # 型定義・ユーティリティ関数
├── animations.ts      # Framer Motion アニメーション設定
├── MenuItemLabel.tsx  # メニューラベル描画（共通）
├── MenuItemLink.tsx   # Link/span 切り替え（共通）
├── Pc/                # PC版コンポーネント（640px以上）
│   ├── PcNavigation.tsx
│   └── PcMenuItem.tsx
└── Sp/                # SP版コンポーネント（640px未満）
    ├── SpNavigation.tsx
    ├── SpNavOverlay.tsx
    ├── SpNavPanel.tsx
    ├── SpMenuItem.tsx
    └── SpNavSwitch.tsx
```

## カスタマイズ箇所

### スロットの中身を変更したい場合
→ `index.tsx` の `HeaderShell` props を編集

```tsx
<HeaderShell
  left={<Brand />}                    // ← ロゴ・左側
  center={<PcNavigation ... />}       // ← PCナビゲーション
  right={<Button>...</Button>}        // ← CTAボタン等
/>
```

### SPメニュー下部のボタンを変更したい場合
→ `index.tsx` の `SpNavigation` の `footer` prop を編集

### ナビゲーション項目を変更したい場合
→ `src/config/user-header.config.ts` を編集

### アニメーションを変更したい場合
→ `animations.ts` を編集

### スタイル・レイアウトを変更したい場合
→ 各コンポーネントの className を編集

## データフロー

```
useHeaderData() → index.tsx → HeaderShell
                           → PcNavigation → PcMenuItem
                           → SpNavigation → SpNavPanel → SpMenuItem
```

## 注意事項

- `Header/` は変更せず、このディレクトリ内で編集すること
- PC/SP の切り替えは Tailwind の `sm:` ブレークポイント（640px）で制御
