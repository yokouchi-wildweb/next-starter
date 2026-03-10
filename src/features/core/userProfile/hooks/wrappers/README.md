# プロフィール hooks ラッパー

ロール固有の型付き hooks をここに配置します。

## 使い方

ベースの hooks は `Record<string, unknown>` 型で動作しますが、
ロール固有の型安全性が必要な場合はラッパーを作成してください。

### 例: ContributorProfile の型付きラッパー

```typescript
// hooks/wrappers/useContributorProfile.ts
import { useProfileByUserId } from "../useProfileByUserId";
import type { ContributorProfile } from "../../generated/contributor";

export const useContributorProfile = (userId?: string | null) => {
  const result = useProfileByUserId("contributor", userId);
  return {
    ...result,
    data: result.data as ContributorProfile | undefined,
  };
};
```

### 例: ContributorProfile の検索ラッパー

```typescript
// hooks/wrappers/useContributorProfileSearch.ts
import { useProfileSearch } from "../useProfileSearch";
import type { ContributorProfile } from "../../generated/contributor";
import type { SearchParams, WithOptions } from "@/lib/crud/types";

export const useContributorProfileSearch = (params: SearchParams & WithOptions) => {
  const result = useProfileSearch("contributor", params);
  return {
    ...result,
    data: result.data as ContributorProfile[],
  };
};
```
