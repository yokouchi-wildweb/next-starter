# date

## Overview

- 日付の lib: プロジェクト共通の dayjs のセットアップ(日本語ロケール・customParseFormat)、ユーザー入力の揺らぎを吸収する柔軟パース、日付らしい値を dayjs にする決まり
- 閉じた lib(入口 `.` だけ)。dayjs だけを読み、ドメインも SDK も React も読まないので、棚(src/components)からも値で読める
- 使う時・直す時の決まりは札 .claude/rules/items/lib/date.md にある

## API

- `dayjs`(`dayjs.ts`): 日本語ロケールと customParseFormat を登録済みの dayjs
- `parseFlexibleDate` / `parseFlexibleTime` / `parseFlexibleDatetime`(`parseFlexible.ts`): ISO・スラッシュ・ドット・詰め・和文などの入力を正規化した文字列に(空なら空文字、読めなければ null)
- `toDayjs(value)`(`value.ts`): 日付らしい値(string / number / Date / dayjs)を dayjs に。文字列は前後の空白を削る。null・undefined・空文字・ほかの型・読めない値は null
- `formatDateLike(value, pattern)`(`value.ts`): `toDayjs` してから dayjs の書式で書く。読めなければ null
- 読めない値をどう見せるかは呼ぶ側が決める: 棚の DateInput(入力の値。読めない文字列は打たれたまま)・tableSuite の EditableGridTable(表の表示)・src/utils/date の formatDateJa(日本時間・fallback 付きの表示。lib/domain の formatDateValue に渡される)

## Related

- 日本時間の表示・日の境目: `src/utils/date.ts`(`formatDateJa`・`startOfDayInTimeZone`・`dayRangeInTimeZone`)
