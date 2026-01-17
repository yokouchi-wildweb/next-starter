# CLAUDE.md

## STACK
next: 16 (react 19, app router)
db: drizzle (neon/postgresql) | firestore
state: zustand, swr
forms: react-hook-form + zod
ui: tailwind 4, shadcn, radix
auth: firebase-auth + jwt
storage: firebase-storage
http: axios (client), fetch (server)

---

## CODE_PLACEMENT (3-tier)

コードの配置先を決める3層構造。

| 層 | 説明 | 配置先 | 含められるもの |
|---|---|---|---|
| domain | ビジネス概念として独立 | src/features/ | 全て（entities含む） |
| library | 複数ファイルで構成される機能群 | src/lib/\<name\>/ | entities以外の全て |
| unit | 単体の小機能 | src/components/, hooks/, utils/ | 小規模（複数ファイル可） |

### 判断フロー
```
1. ビジネスドメイン? -> src/features/
2. 複数ファイルの機能群? -> src/lib/<name>/
   (entitiesが必要 -> domainに格上げ)
3. 単体機能:
   - UI含む -> src/components/
   - hookのみ -> src/hooks/
   - 純粋関数 -> src/utils/
4. ページ固有で再利用なし -> app/<route>/_components/
```

### 依存ルール
- lib -> lib: OK
- lib -> features: 禁止
- features -> features (UI): 相手のhooksを使う（自作禁止）
- features -> features (server): 直接service呼び出しOK（循環禁止）

ref: docs/!must-read/設計思想とアーキテクチャ.md

---

## ARCHITECTURE (8-layer)

```
1. Page (app/**/page.tsx)           -> SSR/SSG entry
2. Component (features/*/components) -> UI
3. Hook (features/*/hooks)           -> state (client only)
4. ClientService (services/client)   -> HTTP via axios
5. APIRoute (app/api/**)             -> HTTP interface
6. ServerService (services/server)   -> business logic + DB
7. Entity (features/*/entities)      -> schema, types, drizzle
8. Database                          -> PostgreSQL | Firestore
```

### client/server境界
```
Client側: Hook/ClientService -> HTTP -> APIRoute -> ServerService
Server側: Page(SSR) -> ServerService (直接呼び出しOK)
禁止: Hook -> ServerService (client直接呼び出し不可)
```

### ルール
- client-side: axios only（fetchは使わない）
- server-side: fetch OK
- DB access: ServerService経由のみ（API routeで直接DB禁止）

---

## DIRECTORY_STRUCTURE

すべてのパスは src/ 配下。

### src/features/\<domain\>/
```
components/
  Admin{List,Create,Edit}/   <- 自動生成（編集禁止）
  common/                    <- ドメイン固有の共有UI
    formEntities.ts          <- カスタマイズ可
entities/
  schema.ts      <- XxxBaseSchema, XxxCreateSchema, XxxUpdateSchema
  form.ts        <- z.infer types
  model.ts       <- TypeScript types
  drizzle.ts     <- DB table definition
services/
  client/xxxClient.ts
  server/
    drizzleBase.ts           <- 自動生成（編集禁止）
    xxxService.ts            <- importのみ（実装書かない）
    wrappers/                <- CRUDメソッド上書き（カスタマイズ可）
hooks/use{Create,Update,Search,Delete}*.ts  <- 自動生成
constants/, types/, presenters.ts, domain.json
```

### コード生成ルール
| 区分 | ファイル | 編集 |
|---|---|---|
| generated | entities/, services/(drizzleBase), hooks/, Admin*/, registry/ | 禁止 |
| customizable | wrappers/, components/**/formEntities.ts, constants/, presenters.ts | 可 |

### src/（共有）
```
components/   <- アプリ横断UI（Admin + User共通）
  AppFrames/  <- Admin/, User/ 各アプリのフレーム
  Form/       <- フォーム部品
  Layout/     <- Block, Flex, Grid, Main, Section
  TextBlocks/ <- Para, SecTitle, PageTitle（+ Main re-export）
  Skeleton/   <- スケルトンUI
  _shadcn/    <- shadcn/ui生成物
hooks/        <- アプリ横断hook（useAppToast, useGlobalLoader等）
utils/        <- 純粋関数
stores/       <- アプリ横断store（後述）
lib/          <- ライブラリ群
config/       <- 設定ファイル
registry/     <- 自動生成レジストリ
proxies/      <- middleware handlers
```

---

## STORES (zustand)

**配置**: src/stores/ にはアプリ横断の共有storeのみ配置。
ドメイン固有のstoreは src/features/\<domain\>/stores/ に配置。

### 構造（必ずサブディレクトリ）
```
stores/<name>/
  index.ts           <- re-export（公開IF）
  internalStore.ts   <- zustand store（内部、直接使用禁止）
  useStore.ts        <- 基本hook
```

### 階層
```
internalStore（内部実装）
    ↓ 使用
useStore（基本アクセス）
    ↓ 使用
src/hooks/useXxx（機能拡張、任意）
```

### ルール
- state-only: ビジネスロジックはservices/で実装
- UI副作用: useStore内のuseEffectで処理
- internalStore: useStore.tsからのみアクセス可

ref: src/stores/README.md

---

## DOMAINS

| 種別 | 配置 | domain.json | 例 |
|---|---|---|---|
| core | src/features/core/ | なし（手動実装） | auth, user, wallet, setting, mail |
| business | src/features/ | あり（dc:generate） | sample, sampleCategory, sampleTag |

### コマンド
- `dc:init` - 初期化
- `dc:generate -- <Domain>` - 単一ドメイン生成
- `dc:generate:all` - 全ドメイン再生成
- `dc:delete -- <Domain>` - ドメイン削除
- `dc:add -- <Domain>` - フィールド追加

ref: src/features/README.md

---

## API_ROUTES

**必須**: 全routeで routeFactory (createApiRoute / createDomainRoute) を使用

### 汎用（app/api/[domain]/）
| メソッド | パス | 操作 |
|---|---|---|
| GET/POST | / | list/create |
| GET/PATCH/DELETE | /[id] | get/update/soft-delete |
| POST | /search | 検索 |
| POST | /upsert | 作成or更新 |
| POST | /bulk/delete-by-ids | 一括削除 |
| POST | /[id]/duplicate | 複製 |
| POST | /[id]/restore | 復元 |
| DELETE | /[id]/hard-delete | 物理削除 |

### ドメイン固有
auth/, admin/, wallet/, webhook/, storage/

ref: src/lib/routeFactory/README.md

---

## CRUD_SERVICE (createCrudService)

### 標準操作
create, list, get, update, remove, search, query, upsert, bulkDeleteByIds, bulkDeleteByQuery

### drizzle限定
belongsToMany（M2M自動同期）

### 拡張方針
1. 標準メソッドで対応可能か確認
2. base.query() + wrappers/ で対応
3. それでも不足 -> カスタムservice

### ファイル構成
```
services/server/
  xxxService.ts      <- importのみ（実装は書かない）
  wrappers/          <- CRUD上書きのみ
  <other>/           <- ドメイン固有service（非CRUD）
```

### firestore制限
- or条件不可
- 単一orderByのみ
- belongsToMany不可

---

## COMPONENTS

### 配置判断
```
他ドメインでも使う?
  ├─ Yes: src/components/ or AppFrames/
  └─ No: features/<domain>/components/common/

そのページでしか使わない?
  └─ Yes: app/<route>/_components/
```

### 既存ラッパー（生HTML禁止）
| 生HTML | ラッパー |
|---|---|
| `<div>` | Layout/{Block, Flex, Grid} |
| `<main>` | Layout/Main or AppFrames/User/Layout/UserPage |
| `<section>` | Layout/Section |
| `<button>` | Form/Button |
| `<input>` | Form/Input |
| `<p>` | TextBlocks/Para |
| `<h2>` | TextBlocks/SecTitle |
| skeleton | Skeleton/BaseSkeleton |

### UserPage と Main の関係
- `UserPage` = `Main` のエイリアス（Userアプリ用）
- `Main` は `<main>` タグをラップし、containerType でレイアウト幅を制御
- h1 は Main/UserPage に含まれない（別途記述が必要）

### UI_LAYERS (4-tier責務分離)

UIコンポーネントの責務を4層に分離。

| 層 | 責務 | hooks呼び出し | 例 |
|---|---|---|---|
| page | SSR entry, 最小タグ | 不可 | page.tsx |
| section_container | セクション単位、`<section>`でラップ | ここで呼ぶ | HeroSection/index.tsx |
| unit_item | 表示のみ | 不可 | CardItem.tsx |
| interaction_parts | "use client"、自己完結した操作 | 最小限OK | LikeButton.tsx |

**ルール**: 上位層でhooksを呼び、props経由でhandlerを渡す

### page-level controls
AppFrames/User/controls/: header/footer/bottomMenu の表示制御（page.tsx内で使用）

### DomainFieldRenderer
domain.json.fields[].formInput -> DomainFieldRenderer -> 各Input
types: textInput, numberInput, textarea, select, multiSelect, radio, checkbox, stepperInput, switchInput, dateInput, timeInput, datetimeInput, emailInput, passwordInput, mediaUploader, hidden, none

ref: src/components/README.md

---

## ERROR_HANDLING

```
ServerService: throw DomainError(status, message)
      ↓
APIRoute: convert to JSON {status, message}
      ↓
ClientService: normalizeHttpError(error, fallback) -> HttpError
      ↓
Hook: pass through HttpError
      ↓
UI: err(error, fallback) for display
```

---

## NAMING

| 対象 | 規則 |
|---|---|
| components | PascalCase or dir/index.tsx |
| hooks | useCamelCase.ts |
| services | camelCase.ts |
| entities | lowercase files, PascalCase types |
| routes | kebab-case or (group) |
| constants | UPPER_SNAKE_CASE |
| index.ts | re-exportのみ（実装ロジック禁止） |

---

## PROHIBITED

- [ ] client-sideでfetch使用（axios必須）
- [ ] API routeで直接DB操作（ServerService経由必須）
- [ ] ラッパー存在時に生HTML
- [ ] entities/schema.ts にformスキーマ（formEntities.ts使用）
- [ ] HookからServerService呼び出し
- [ ] ClientServiceでnormalizeHttpErrorスキップ
- [ ] belongsToMany使用可能時に手動M2M同期
- [ ] 標準CRUDで対応可能時に再実装
- [ ] 生成ファイル直接編集（wrappers使用）
- [ ] routeFactory未使用のAPI route
- [ ] 直接asset path（utils/assets使用: assetPath, imgPath, videoPath, logoPath）

---

## CORE_FILES (変更要承認)

- src/lib/
- src/features/core/
- src/components/
- scripts/domain-config/
- src/styles/config.css
- src/styles/z-layer.css

### src/config/
- 値の変更: 承認不要
- 構造変更（キー追加/削除、型変更、リネーム）: 承認必要

---

## TOOLS

playwright-mcp: CSS/UI検証、動的コンテンツ確認、WebSearch/WebFetch失敗時

---

## SCRIPTS

ref: scripts/README.md
claude:test -> Claude API接続確認（ANTHROPIC_API_KEY必要）

---

## DOCS

location: docs/
structure: !must-read/, concepts/, how-to/, core-specs/, troubleshooting/, reference/, self-evaluation/
