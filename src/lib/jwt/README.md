# JWT ユーティリティ

## Overview

- JWT の署名・検証・Cookie 抽出の薄いラッパー。入口 `@/lib/jwt`
- ドメイン固有のスキーマを注入する汎用 API なので、クレームの正規化は呼び手が行う
- 呼び手は auth のセッションの層(`src/features/core/auth/services/server/session/` など)。API ルートの主体は Factory の `ctx.user`(CLAUDE.md API_ROUTES principal)

## Usage

### 署名

```ts
import { signUserToken } from "@/lib/jwt";
import { SessionUserSchema } from "@/features/auth/entities/session";

const sessionUser = SessionUserSchema.parse({
  userId: "user_123",
  role: "admin",
  status: "active",
  providerType: "local",
  providerUid: "user_123",
  name: "管理者ユーザー",
});

const { token, expiresAt } = await signUserToken({
  subject: sessionUser.userId,
  claims: {
    role: sessionUser.role,
    status: sessionUser.status,
    providerType: sessionUser.providerType,
    providerUid: sessionUser.providerUid,
    name: sessionUser.name,
  },
});
```

### 検証

```ts
import { verifyUserToken } from "@/lib/jwt";
import { SessionUserSchema, TokenPayloadSchema } from "@/features/auth/entities/session";

const result = await verifyUserToken(token, {
  claimsParser: (claims) => {
    const candidate = {
      ...claims,
      sub: claims.sub ?? "",
    };

    const parsed = TokenPayloadSchema.safeParse(candidate);

    if (!parsed.success) {
      return null;
    }

    return SessionUserSchema.parse({
      userId: parsed.data.sub,
      role: parsed.data.role,
      status: parsed.data.status,
      providerType: parsed.data.providerType,
      providerUid: parsed.data.providerUid,
      name: parsed.data.name ?? null,
    });
  },
});

if (result) {
  console.log(result.subject); // => "user_123"
  console.log(result.claims);  // => SessionUser 型
}
```

## API

- `signUserToken({ subject, claims })` → `{ token, expiresAt }`(`expiresAt` は `Date`)。`claims` はそのままペイロードに入るので、ドメイン固有の情報を足せる
- `verifyUserToken(token, { claimsParser })` → `{ subject, claims } | null`。署名と有効期限を確かめ、`claimsParser` でドメイン固有の型へ正規化した結果を返す。`claimsParser` が `null` を返すとトークンは無効
- `parseSessionCookie(cookies)` → `RequestCookies` / `ResponseCookies` からセッショントークン値を取り出す
- 定数: `SESSION_COOKIE_NAME`・`SESSION_DEFAULT_MAX_AGE_SECONDS`(設定の値)

## Extension

- 上書き `src/config/lib/jwt.config.ts`(`@lib-config/jwt`): `cookieName`(既定 `"__session"`)・`defaultMaxAgeSeconds`(既定 7 日)。キーと既定は `config.ts`

## Related

- セッションの読み方: `src/features/core/auth/README.md`
