# FooterCustom

カスタマイズ用のフッターコンポーネント。`Footer/` のコピーであり、自由に編集可能。

## ディレクトリ構成

```
FooterCustom/
├── index.tsx   # エントリーポイント（レイアウト・表示内容を編集）
└── README.md   # このファイル
```

## カスタマイズ箇所

### SNSリンクを変更したい場合
→ `src/config/user-footer.config.ts` の `socialLinks` を編集

### フッターリンクを変更したい場合
→ `src/config/user-footer.config.ts` の `footerLinks` を編集

### コピーライトを変更したい場合
→ `src/config/user-footer.config.ts` の `copyrightText` を編集

### レイアウト・スタイルを変更したい場合
→ `index.tsx` の JSX・className を編集

## データフロー

```
useFooterData() → index.tsx → SNSリンク / フッターリンク / コピーライト
```

## 注意事項

- `Footer/` は変更せず、このディレクトリ内で編集すること
