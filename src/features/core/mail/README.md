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

### 3. 設定

#### 環境変数（.env.development / .env.production）

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

APIキーのみ環境変数で管理します。

#### ビジネス設定（src/config/business.config.ts）

送信元アドレスと送信者名は `businessConfig` で管理します：

```ts
mail: {
  /** デフォルト送信元アドレス */
  defaultFrom: "noreply@example.com",

  /** デフォルト送信者名 */
  defaultFromName: "サービス名",
},
```

## ディレクトリ構成

```
src/features/core/mail/
├── README.md           # このファイル
├── constants/
│   └── colors.ts       # テーマカラー定数（自動生成）
└── templates/
    └── VerificationEmail.tsx  # メールテンプレート

src/lib/mail/
├── index.ts               # send() 関数
├── createMailTemplate.tsx # ファクトリー関数
└── resend.ts              # Resendクライアント
```

## テンプレートの追加方法

### 1. テンプレートファイルを作成

`templates/` に新しいテンプレートを追加:

```tsx
// templates/WelcomeEmail.tsx

import { Html, Text, Button } from "@react-email/components";
import { createMailTemplate } from "@/lib/mail";
import { MAIL_THEME_COLORS } from "../constants/colors";

type Props = {
  username: string;
  dashboardUrl: string;
};

function WelcomeEmailComponent({ username, dashboardUrl }: Props) {
  return (
    <Html>
      <Text>ようこそ、{username}さん！</Text>
      <Button href={dashboardUrl}>ダッシュボードへ</Button>
    </Html>
  );
}

export const WelcomeEmail = createMailTemplate({
  subject: "ようこそ！",
  component: WelcomeEmailComponent,
  testProps: {
    username: "テストユーザー",
    dashboardUrl: "https://example.com/dashboard",
  },
  testDescription: "新規ユーザー向けウェルカムメール",
  // 送信元を指定（省略時は businessConfig.mail.defaultFrom）
  from: "support@example.com",
  fromName: "サポートチーム",
});
```

### 2. 送信する

```ts
import { WelcomeEmail } from "@/features/core/mail/templates/WelcomeEmail";

// 基本的な送信
await WelcomeEmail.send("user@example.com", {
  username: "田中太郎",
  dashboardUrl: "https://example.com/dashboard",
});

// 送信元を上書きする場合
await WelcomeEmail.send(
  "user@example.com",
  { username: "田中太郎", dashboardUrl: "..." },
  {
    from: "special@example.com",
    fromName: "特別キャンペーン",
  },
);
```

### createMailTemplate のオプション

| オプション | 必須 | 説明 |
|-----------|------|------|
| `subject` | ✅ | メールの件名 |
| `component` | ✅ | テンプレートコンポーネント |
| `testProps` | ✅ | テスト送信時に使用するprops |
| `testDescription` | - | テンプレート選択画面に表示する説明 |
| `from` | - | 送信元アドレス（省略時は `businessConfig.mail.defaultFrom`） |
| `fromName` | - | 送信者名（省略時は `businessConfig.mail.defaultFromName`） |

### 送信元の優先順位

1. `send()` の第3引数（最優先）
2. `createMailTemplate()` の設定
3. `businessConfig.mail.defaultFrom` / `defaultFromName`（フォールバック）

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
送信元: サービス名 <noreply@example.com>
送信先: admin@example.com
テンプレート: VerificationEmail

? 送信しますか? Yes

✅ 送信完了!
メールID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### テンプレートの自動検出

`templates/` ディレクトリ内の `.tsx` ファイルが自動的に検出されます。
`createMailTemplate()` で作成されたオブジェクトがエクスポートされていれば、テスト送信の選択肢に表示されます。

## テーマカラー

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

- `RESEND_API_KEY` のみ環境変数で管理
- 送信元アドレス等は `businessConfig` で設定
