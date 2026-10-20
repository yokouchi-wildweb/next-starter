/**
 * dc:* コマンドの引数を取得する。
 *
 * `pnpm dc:generate -- Sample` のように書くと pnpm は `--` をそのまま渡すため、
 * 単独の `--` を取り除いて `pnpm dc:generate Sample` と同じ引数列にする。
 */
export function getCliArgs(argv = process.argv) {
  return argv.slice(2).filter((arg) => arg !== "--");
}
