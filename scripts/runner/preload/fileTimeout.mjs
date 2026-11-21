// テストのファイルごとの時間の上限(pnpm test の入口 scripts/runner/test/run.mjs が --import で全部の子に付ける)。
// 働くのは node --test が 1 ファイルごとに起動する子の中だけ(印 = env NODE_TEST_CONTEXT。親の node --test では何もしない)。
// 上限(env TEST_FILE_TIMEOUT 秒、既定 120、0 = 上限なし)を過ぎたら名前を出して exit 1: 親の node --test はそのファイルを
// 落ちた物としてまとめに名前を出し、ほかのファイルは回り続ける。
//
// 背景: node の --test-timeout は 1 つの test() ごとで、ファイルのプロセスには効かない。落ちた後やテストが全部通った後に
// タイマー・接続などが残ったファイルは終わらず、入口ごと黙って止まる(実測: --test-timeout を付けても止まらない)。
// タイマーは unref するので、普通に終わるファイルを引き止めない。
// 効かない物: 同期の無限ループ(CPU を回し続けて、タイマーが動けない)。
const raw = process.env.TEST_FILE_TIMEOUT;
const seconds = raw === undefined || raw === "" ? 120 : Number(raw);

if (process.env.NODE_TEST_CONTEXT && Number.isFinite(seconds) && seconds > 0) {
  const file = process.argv[1] ?? "(不明)";
  const shown = file.startsWith(`${process.cwd()}/`) ? file.slice(process.cwd().length + 1) : file;
  setTimeout(() => {
    process.stderr.write(
      `test: 時間切れ ${seconds} 秒: ${shown}(終わらないファイルを止めた。残った接続・タイマーを確かめる。遅いだけなら /ship の検査で TEST_FILE_TIMEOUT=<秒> か pnpm test --file-timeout=<秒> で延ばす)\n`,
    );
    process.exit(1);
  }, seconds * 1000).unref();
}
