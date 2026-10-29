# FooterCustom

> **廃止予定**: config の部品切り替え(HeaderCustom / FooterCustom)は旧来の方式で、旧入口撤去の区切りで削除します。新しく差し替えるときは、`src/app/(user)/_layout/UserLayout.<project>.tsx`(ドット区切り名のカスタム)で既定の `UserLayout` に `header` / `footer` slot として自分の部品を渡し、`src/app/(user)/layout.tsx` をそちらへ向けます。手順: [src/app/(user)/_layout/README.md](../../../../../app/(user)/_layout/README.md)「layout.tsx と slot」。それまでは下の切り替えも動きます(UserLayout は slot 省略時に config の部品を描く)。

> **ページ単位で隠す印(Hide*)に従う**: 雛形の部品は外側の要素に `data-frame-part`(`header` / `header-nav` / `footer`)を持ち、`HideHeader` 等の印で隠れる。雛形を編集・コピーするときもこの属性を残す(別名の部品にした場合は外側の要素に付ける)。仕組み: [src/app/(user)/_layout/README.md](../../../../../app/(user)/_layout/README.md)「枠の部位を隠す(Hide* と印)」

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
