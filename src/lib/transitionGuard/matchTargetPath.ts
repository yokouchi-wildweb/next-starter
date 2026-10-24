/**
 * 遷移トークンの照合に使うパスに揃える(クエリ `?…` と `#…` を外したパス名)
 *
 * guardedPush("/signup/register?method=thirdParty") のように遷移先にクエリを付けても、
 * 遷移先で比べる usePathname() はパス名だけなので、照合はパス名どうしで行う
 */
export function toGuardPath(path: string): string {
  const end = path.search(/[?#]/);
  return end === -1 ? path : path.slice(0, end);
}

/**
 * トークンの遷移先と現在のパスが一致するか(パス名の完全一致。前方一致はしない)
 */
export function matchesTargetPath(targetPath: string, currentPath: string): boolean {
  return toGuardPath(targetPath) === toGuardPath(currentPath);
}
