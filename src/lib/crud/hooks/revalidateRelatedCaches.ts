/**
 * CRUD 操作後のキャッシュ再検証。
 * revalidateKey に完全一致する文字列キーに加え、
 * revalidateKey + "/" をプレフィックスに持つ配列キー
 * （useSearchDomain, useSearchForSortingDomain 等）も再検証対象にする。
 */
export async function revalidateRelatedCaches(
  mutate: (matcher: (key?: any) => boolean) => Promise<unknown>,
  revalidateKey: string | string[],
): Promise<void> {
  const keys = Array.isArray(revalidateKey) ? revalidateKey : [revalidateKey];

  await mutate((cacheKey?: unknown) => {
    // 文字列キー: 完全一致（useDomainList 等）
    if (typeof cacheKey === "string") {
      return keys.includes(cacheKey);
    }
    // 配列キー: 先頭要素がプレフィックス一致（useSearchDomain 等）
    if (Array.isArray(cacheKey) && typeof cacheKey[0] === "string") {
      return keys.some(
        (k) => cacheKey[0] === k || cacheKey[0].startsWith(k + "/"),
      );
    }
    return false;
  });
}
