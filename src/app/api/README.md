# API Routes

## Overview

- このフォルダの route.ts は HTTP の export(GET など)を Factory の呼び出しで作る: `@/wiring/apiRoute` の createApiRoute / createDomainRoute / createMeRoute / createDeviceRoute、cron は `@/wiring/cronRoute` の createCronTaskRoute
- ハンドラを直に export する形は lint `route-http-export/http-export` が止める(下の ❌ の例)

## Usage

```ts
// ✅ 正しい例
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute(
  { operation: "GET /api/example", operationType: "read", access: "authenticated" },
  async (req, { user }) => { ... } // 主体は Factory が解いた ctx.user（route でセッションを引かない）
);

// ❌ 禁止例
export const GET = async (req: NextRequest) => { ... };
```

## Related

- ファクトリーの詳しい使用方法: [src/lib/routeFactory/README.md](../../lib/routeFactory/README.md)
