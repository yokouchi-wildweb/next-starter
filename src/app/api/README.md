# API Routes

このディレクトリ配下のすべてのAPIルートは、**routeFactory を経由して作成する必要があります**。

直接ハンドラをエクスポートすることは禁止されています。

---

## 必須: routeFactory の使用

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

---

## 詳細ドキュメント

ファクトリーの詳しい使用方法は以下を参照してください:

→ [src/lib/routeFactory/README.md](../../lib/routeFactory/README.md)
