# Mail Feature

Resendを使用したメール送信機能です。

## セットアップ

### 1. Resendアカウントの作成

1. [Resend](https://resend.com) でアカウントを作成
2. APIキーを発行

### 2. ドメイン認証

1. Resendコンソールで送信元ドメインを追加
2. 表示されるDNSレコード（DKIM、SPF等）をドメインのDNS設定に追加
3. Resendコンソールで「Verify」をクリックして認証を完了

### 3. 環境変数の設定

`.env.development` および `.env.production` に以下を追加:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
MAIL_FROM_ADDRESS=noreply@yourdomain.com
```

- `RESEND_API_KEY`: Resendで発行したAPIキー
- `MAIL_FROM_ADDRESS`: 送信元メールアドレス（認証済みドメインを使用）

## ディレクトリ構成

```
src/features/core/mail/
├── README.md           # このファイル
├── constants/
│   ├── index.ts        # メール関連の定数（件名など）
│   └── colors.ts       # テーマカラー定数（自動生成）
├── templates/
│   └── VerificationEmail.tsx  # メールテンプレート（React Email）
└── services/
    └── server/
        └── sendVerificationEmail.tsx  # メール送信サービス
```

## テーマカラーの自動同期

メールテンプレートでプロジェクトのテーマカラーを使用できます。

### 仕組み

```
src/styles/theme.css (Single Source of Truth)
    ↓ ビルド時に自動変換
src/features/core/mail/constants/colors.ts (自動生成)
    ↓ 参照
メールテンプレート
```

- `theme.css` の `:root` セクションから oklch 値を抽出
- hex 形式に変換して `colors.ts` を自動生成
- `npm run build` 時に自動実行（prebuild）

### 使い方

```tsx
import { MAIL_THEME_COLORS } from "../constants/colors";

const styles = {
  button: {
    backgroundColor: MAIL_THEME_COLORS.primary,
    color: MAIL_THEME_COLORS.primaryForeground,
  },
};
```

### 利用可能なカラー

| キー | 対応するCSS変数 |
|------|----------------|
| `primary` | `--primary` |
| `primaryForeground` | `--primary-foreground` |
| `secondary` | `--secondary` |
| `secondaryForeground` | `--secondary-foreground` |
| `muted` | `--muted` |
| `mutedForeground` | `--muted-foreground` |
| `accent` | `--accent` |
| `accentForeground` | `--accent-foreground` |
| `destructive` | `--destructive` |
| `background` | `--background` |
| `foreground` | `--foreground` |
| `border` | `--border` |

### 手動で再生成する場合

```bash
npm run generate:mail-colors
```

## テンプレートの追加方法

### 1. テンプレートファイルを作成

`templates/` に新しいテンプレートを追加:

```tsx
// templates/WelcomeEmail.tsx
import { Html, Text, Button } from "@react-email/components";

export type WelcomeEmailProps = {
  username: string;
};

export function WelcomeEmail({ username }: WelcomeEmailProps) {
  return (
    <Html>
      <Text>ようこそ、{username}さん！</Text>
    </Html>
  );
}
```

### 2. 送信サービスを作成

`services/server/` に送信サービスを追加:

```tsx
// services/server/sendWelcomeEmail.tsx
import { send } from "@/lib/mail";
import { WelcomeEmail } from "../../templates/WelcomeEmail";

export async function sendWelcomeEmail(to: string, username: string) {
  await send({
    to,
    subject: "ようこそ！",
    react: <WelcomeEmail username={username} />,
  });
}
```

### 3. 必要に応じてAPIルートから呼び出す

```ts
import { sendWelcomeEmail } from "@/features/core/mail/services/server/sendWelcomeEmail";

await sendWelcomeEmail("user@example.com", "田中太郎");
```

## テスト方法

### テストスクリプトの実行

Resendの設定が正しいかを確認するためのテストスクリプト:

```bash
npx tsx scripts/test-mail.ts <送信先メールアドレス>
```

例:

```bash
npx tsx scripts/test-mail.ts your-email@example.com
```

成功すると以下のように表示されます:

```
=== Resend メール送信テスト ===
送信元: noreply@yourdomain.com
送信先: your-email@example.com

送信成功!
メールID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## React Email コンポーネント

テンプレートで使用できる主要コンポーネント:

| コンポーネント | 用途 |
|---------------|------|
| `<Html>` | ルート要素 |
| `<Head>` | メタ情報 |
| `<Preview>` | プレビューテキスト（受信トレイに表示） |
| `<Body>` | 本文のラッパー |
| `<Container>` | 中央寄せコンテナ |
| `<Section>` | セクション分け |
| `<Text>` | テキスト |
| `<Heading>` | 見出し |
| `<Button>` | ボタンリンク |
| `<Link>` | テキストリンク |
| `<Img>` | 画像 |

詳細: https://react.email/docs/components

## トラブルシューティング

### メールが届かない

1. Resendコンソールでドメインが「Verified」になっているか確認
2. 迷惑メールフォルダを確認
3. Resendコンソールの「Emails」でエラーがないか確認

### DNS認証が不安定

- DNS伝播には最大24〜48時間かかることがある
- 設定直後は「Verified」と「Pending」を繰り返すことがある
- 時間をおいて再確認

### 環境変数が読み込まれない

- Next.js開発サーバー: `.env.development` が自動で読み込まれる
- スクリプト直接実行: `dotenv` で明示的に読み込む必要がある（test-mail.tsを参照）
