# プロフィール hooks ラッパー

## Overview

- ロール固有の型付き hooks を置く場所。ベースの hooks は `Record<string, unknown>` 型で動くので、ロール固有の型が要るときは薄いラッパーを作る(決まりは `.claude/rules/items/features/userProfile.md` の typed_wrapper)
- ここに置くのは Tier1 のロールの物。fork のロールのラッパーは fork 自身のドメインの `hooks/` に置く(fork は `src/features/core/` にファイルを足せない)

## Usage

例: ContributorProfile の型付きラッパー

```typescript
// hooks/wrappers/useContributorProfile.ts
import { useProfileByUserId } from "../useProfileByUserId";
import type { ContributorProfile } from "../../entities/profiles/contributor";

export const useContributorProfile = (userId?: string | null) => {
  const result = useProfileByUserId("contributor", userId);
  return {
    ...result,
    data: result.data as ContributorProfile | undefined,
  };
};
```

例: ContributorProfile の検索ラッパー

```typescript
// hooks/wrappers/useContributorProfileSearch.ts
import { useProfileSearch } from "../useProfileSearch";
import type { ContributorProfile } from "../../entities/profiles/contributor";
import type { SearchParams, WithOptions } from "@/lib/crud";

export const useContributorProfileSearch = (params: SearchParams & WithOptions) => {
  const result = useProfileSearch("contributor", params);
  return {
    ...result,
    data: result.data as ContributorProfile[],
  };
};
```
