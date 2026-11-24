// テストのファイルごとの時間の上限(pnpm test の入口 scripts/runner/test/run.mjs が --import で全部の子に付ける)。
// 働くのは node --test が 1 ファイルごとに起動する子の中だけ(印 = env NODE_TEST_CONTEXT。親の node --test では何もしない)。
// 上限(env TEST_FILE_TIMEOUT 秒、既定 120、0 = 上限なし)= そのファイルのテストが全部終わった後に、プロセスが出ないでいる時間。
// 過ぎたら名前を出して exit 1: 親の node --test はそのファイルを落ちた物としてまとめに名前を出し、ほかのファイルは回り続ける。
//
// 背景: node の --test-timeout は 1 つの test() ごとで、ファイルのプロセスには効かない。落ちた後やテストが全部通った後に
// タイマー・接続などが残ったファイルは終わらず、入口ごと黙って止まる(実測: --test-timeout を付けても止まらない)。
// 数え始めはテストの後(node:test の root の after): 起動からの壁時計で数えると、負荷の中で遅いだけのファイルも落ちた
// (受信箱 20261121-044322-test-file-limit-under-load: 全体の実行で 195 秒・199 秒、単独なら 48 秒で全部通る)。
// テストの途中で止まる物は test() ごとの上限(--test-timeout、既定 60 秒)が見る。
// 押さえ: テストに入る前(読み込みの途中)で止まるファイルは after が来ないので、起動から上限の 10 倍で同じく落とす。
// タイマーは unref するので、普通に終わるファイルを引き止めない。
// 効かない物: 同期の無限ループ(CPU を回し続けて、タイマーが動けない)。
import { after } from "node:test";

const raw = process.env.TEST_FILE_TIMEOUT;
const seconds = raw === undefined || raw === "" ? 120 : Number(raw);
export const BACKSTOP_FACTOR = 10;

if (process.env.NODE_TEST_CONTEXT && Number.isFinite(seconds) && seconds > 0) {
  const file = process.argv[1] ?? "(不明)";
  const shown = file.startsWith(`${process.cwd()}/`) ? file.slice(process.cwd().length + 1) : file;
  const stop = (limit, when) =>
    setTimeout(() => {
      process.stderr.write(
        `test: 時間切れ ${limit} 秒(${when}): ${shown}(終わらないファイルを止めた。残った接続・タイマーを確かめる。遅いだけなら /sluice の検査で TEST_FILE_TIMEOUT=<秒> か pnpm test --file-timeout=<秒> で延ばす)\n`,
      );
      process.exit(1);
    }, limit * 1000).unref();
  stop(seconds * BACKSTOP_FACTOR, "起動から");
  after(() => {
    stop(seconds, "テストの後");
  });
}
