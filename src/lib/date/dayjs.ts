// src/lib/date/dayjs.ts
//
// プロジェクト共通の dayjs セットアップ。
// 日本語ロケールと柔軟なパース用プラグインをここで一括登録し、
// 日付入力系コンポーネントから副作用 import で利用する。

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/ja";

dayjs.extend(customParseFormat);

export { dayjs };
