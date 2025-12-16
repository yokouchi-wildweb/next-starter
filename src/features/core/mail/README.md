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
    ↓ 手動で変換コマンドを実行
src/features/core/mail/constants/colors.ts (自動生成)
    ↓ 参照
メールテンプレート
```

- `theme.css` の `:root` セクションから oklch 値を抽出
- hex 形式に変換して `colors.ts` を自動生成
- **テーマカラー変更時は手動でコマンド実行が必要**

> ⚠️ **重要**: Firebase App Hostingの特殊なパス構造では`npx tsx`が動作しないため、
> ビルド時の自動生成は無効化されています。テーマカラーを変更した場合は、
> 必ず以下のコマンドを実行し、生成されたファイルをコミットしてください。

### テーマカラー変更時の手順

1. `src/styles/theme.css` を編集
2. 以下のコマンドを実行:
   ```bash
   npm run mail:generate-colors
   ```
3. 生成された `src/features/core/mail/constants/colors.ts` をコミット

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
npm run mail:generate-colors
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

export default WelcomeEmail;

// ========================================
// テスト送信用の設定（npm run mail:test で使用）
// ========================================

/** テスト送信時に使用するprops */
export const testProps: WelcomeEmailProps = {
  username: "テストユーザー",
};

/** テスト送信時の件名 */
export const testSubject = "【テスト】ようこそ！";

/** テンプレート選択画面に表示する説明（任意） */
export const testDescription = "新規ユーザー向けウェルカムメール";
```

| エクスポート | 必須 | 説明 |
|-------------|------|------|
| `default` | ✅ | テンプレートコンポーネント |
| `testProps` | ✅ | テスト送信時に使用するprops |
| `testSubject` | ✅ | テスト送信時の件名 |
| `testDescription` | - | テンプレート選択画面に表示する説明 |

> **Note**: `testProps`、`testSubject` をエクスポートすると、`npm run mail:test` のテンプレート選択に自動で追加されます。

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

## テスト送信

### 対話式テスト送信

テンプレートを選択してテストメールを送信できます:

```bash
npm run mail:test
```

実行すると以下のような対話式プロンプトが表示されます:

```
📧 メールテンプレート テスト送信

テンプレートを検出中...
2 件のテンプレートが見つかりました

? 送信先メールアドレス: admin@example.com

? 送信するテンプレートを選択:
❯ シンプルテストメール - Resend接続確認用のシンプルなテストメール
  VerificationEmail - メールアドレス認証用テンプレート

=== 送信情報 ===
送信元: noreply@yourdomain.com
送信先: admin@example.com
テンプレート: VerificationEmail

? 送信しますか? Yes

✅ 送信完了!
メールID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### テンプレートの自動検出

`templates/` ディレクトリ内の `.tsx` ファイルが自動的に検出されます。
テンプレートが選択肢に表示されるには、以下のエクスポートが必要です:

- `default` - テンプレートコンポーネント
- `testProps` - テスト用のprops
- `testSubject` - テスト用の件名

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
