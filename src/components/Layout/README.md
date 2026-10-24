# Layout コンポーネント

## コンポーネント選択ガイド

### Block / Flex / Stack の使い分け

| コンポーネント | 目的 | 使用場面 |
|--------------|------|---------|
| Block | シンプルなラッパー | レイアウト制御不要、余白やappearanceのみ必要 |
| Flex | 配置制御 | 横並び、中央揃え、justify/alignが必要 |
| Stack | 縦方向の余白制御 | 子要素間に一定の縦余白を設けたい（space-yの代替）|

**よくある誤用**:
- 単なるdivラッパーにFlex → Blockを使用
- 縦並びで余白だけ必要なのにFlex → Stackを使用
- レイアウト不要なのにStack → Blockを使用

### 全コンポーネント一覧

| コンポーネント | 出力要素 | 用途 |
|--------------|---------|------|
| Block | div | シンプルなブロック要素 |
| InBlock | span | インラインブロック要素 |
| Flex | div | Flexboxレイアウト（配置制御） |
| Stack | div | 縦方向スタック（余白制御特化） |
| Grid | div | CSSグリッドレイアウト |
| Section | section等 | セマンティックセクション（as propで要素変更可） |
| Main | main | ページメインコンテンツ（containerTypeで幅制御） |
| FullScreen | div | フルスクリーン表示（モバイル対応） |
| ScaledStage | div | 固定の論理 W×H を transform:scale でコンテナにフィット（レターボックス） |
| Hidden | div | 非表示要素（display: none） |

### 共通props

全コンポーネント共通: `appearance`, `padding`, `paddingBlock`, `paddingInline`, `margin`, `marginBlock`, `marginInline`

### 詳細

#### Section
`as` propで出力要素を変更可能: `section`（default）, `article`, `aside`, `nav`, `header`, `footer`
選び方は HTML の意味で決める（独立した単位 → `article`、補足 → `aside`、ナビ → `nav`、それ以外 → `section`。生タグは書かない）: `docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md` §4

#### Main
`containerType`で幅を制御:
- `plain`: 幅制限なし
- `narrowStack`: 狭い幅（フォーム等）
- `contentShell`: 標準幅（default）
- `wideShowcase`: 広い幅
- `fullscreen`: フルスクリーン

`verticalAlign`でコンテンツの縦位置を制御(`plain`・`fullscreen` 以外の型で効く):
- `center`: 余白があれば縦中央寄せ（default。ログイン・エラー等の短いページ向け）
- `start`: 上揃え（縦に長いコンテンツのページ向け）

#### FullScreen
モバイルブラウザのアドレスバーを考慮した真のフルスクリーン表示。`layer` propでz-index層を指定。

#### ScaledStage
`logicalWidth` × `logicalHeight` の論理 px で組んだ子を、コンテナに収まる倍率で transform:scale する（`useFitScale` を内蔵、"use client"）。`fit`: `contain`（既定、レターボックス）/ `width` / `height`、`minScale` / `maxScale`、`align`、`overflow`。サイネージ・キオスク・固定比率の盤面など「カンプ忠実」が優先される画面向け。流体レイアウトとの使い分けと詳細は [AppFrames/Kiosk/README.md](../AppFrames/Kiosk/README.md)。
