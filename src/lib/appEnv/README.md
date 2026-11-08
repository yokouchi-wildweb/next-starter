# src/lib/appEnv — 段階(APP_ENV)の唯一の読み手

本番か・開発用の機能を開けてよいかなど、**段階の判断はすべてこのライブラリを通す**(本部 D178、全 Tier 共通)。

## 決まり

- 段階 = env ファイルに書く `APP_ENV` の 1 つだけ: `development` | `staging` | `production`
- **値が無い・知らない値は `production`**(危ない側を開けない)。`.env.development` には必ず `APP_ENV=development` を書く(`.env.example` と `pnpm ops setup env` が書く)
- **`NODE_ENV` はプロジェクトの決まりに使わない**: env に書かず、プロジェクトのコードから読まない。Next の外(scripts・`node --test`)では空になり、staging でも `production` になるので段階を表せない。Next・React の内部の使い方はそのまま
- `process.env.APP_ENV` / `process.env.NODE_ENV` を直接読むのはこのフォルダだけ。外で読むと lint `app-env/single-reader` が落とす(上流 = error、fork = warn。`eslint-rules/app-env.mjs`)

## 使い方

```ts
import { getAppEnv, isDevelopment, isProduction, isStaging } from "@/lib/appEnv";

getAppEnv(); // "development" | "staging" | "production"
if (isDevelopment()) console.warn("開発中だけの警告");
```

| 関数 | 返すもの |
| --- | --- |
| `getAppEnv()` | 今の段階(呼ぶたびに読む。キャッシュしない) |
| `isDevelopment()` / `isStaging()` / `isProduction()` | その段階か |
| `parseAppEnv(raw)` | 文字列を段階に直す(無い・知らない値 → `production`)。`process.env` 以外の env の束を受け取る関数用(例 `scripts/workflow/dev-admin/lib.ts`) |
| `withAppEnv(value, fn)` | テスト用。段階を一時的に差し替えて `fn` を実行し、元に戻す(`undefined` = 値なし。Promise は決着後に戻す) |
| `setAppEnv(value)` | テスト用。段階を差し替え、差し替える前に戻す関数を返す(1 つのテストで何度も切り替えるとき) |
| `APP_ENVS` / `AppEnv` | 段階の一覧と型 |

## env ファイルの規則(fork 共通)

- 必ず置く: `.env.development` と `.env.production`(リリース前でも。`pnpm ops setup env` が両方作る)。各ファイルに段階の印 `APP_ENV=<段階>` を 1 行
- 開発と本番は別の DB(Neon ならブランチ)。本番の `DATABASE_URL` が空(リリース前)は未設定として扱う
- 拡張: `.env.staging`(`--env staging`)。個人の上書き・秘密は `.env.<段階>.local`(git に入れない)。preview はホスティング側の設定
- 本番の秘密の値はホスティング側に置くのを推奨(必須ではない)
- 書く道具(pnpm task・db:push・seed・clear・storage・mail 等)は既定で開発に向き、本番は `--env production` と確認(非対話は `--confirm=production`)。読んだファイルの印と接続先で本当の向き先を確かめる: `scripts/runner/guard/README.md`

## どの判断にどれを使うか

- **開発用の補助**(警告・デバッグ表示・書き間違いの throw・認証の素通し・ダミーの決済など): `isDevelopment()`。staging は本番と同じ側に置く(本番に近い確かめの場なので、開発用の物は開けない)
- **本番だけの動き**: `!isDevelopment()` か `isProduction()` を意味で選ぶ。staging でも効かせたいなら `!isDevelopment()`(例: cookie の `secure`)
- 判断が「開発サーバーかビルドか」(HMR など)の意味しか持たないなら、段階で分けずに済む形にする(例: `src/lib/drizzle` の接続の使い回しは常に行う)

## どこでも同じ答え

- **server / scripts / テスト**: 実行時の `process.env.APP_ENV` を読む。scripts は env ファイル(`ENV_FILE`、既定 `.env.development`)を dotenv で読んだ後の値
- **client**: `next.config.ts` の `env` が `getAppEnv()` の正規化した値をビルドに埋め込む。読み手は `process.env.APP_ENV` の字面のまま読む(分割代入にすると埋め込みが効かない)
- `ENV_FILE` は「読む env ファイルの場所」で、段階ではない(scripts と DB テストが使う)

## テスト

- `pnpm test src/lib/appEnv/appEnv.test.ts` — 3 つの値・値なし・空・知らない値・空白・withAppEnv / setAppEnv の復元
- `pnpm test eslint-rules/app-env.test.mjs` — lint 規則
