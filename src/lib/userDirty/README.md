# userDirty — 要求の中で再計算が要る利用者を集め、コミットの後にまとめて流す回収口

## Overview

- 業務のトランザクションの奥(紹介の報酬の付与・購入の完了・クーポンの帰属の報酬)で決まった「再計算が要る user_id」を、外側のトランザクションのコミットの後にまとめて拾う口。入口 `@/lib/userDirty/server` だけ(node の AsyncLocalStorage を使うので server だけが読む。client でも読める入口 `.` は無い)
- 積む側は `markUserDirty(userId)` を呼ぶだけ。DB に触れず、トランザクションを伸ばさない
- 流す中身(再計算など)はこの lib に無い。下流が `registerUserDirtyFlushHandler` で差し込む。上流は差し込まない(登録が無ければ何もしない)
- 範囲を敷く入口: routeFactory の createApiRoute(createDomainRoute・createMeRoute を含む)と createDeviceRoute。pnpm task・cron・seed は包まない(範囲の外の印は無視され、日次の全再計算などの安全網が補う前提)

## Usage

```ts
import { markUserDirty, registerUserDirtyFlushHandler, runWithUserDirtyTracking } from "@/lib/userDirty/server";

// 下流: 起動時に 1 回、流す中身を差し込む
registerUserDirtyFlushHandler((userIds) => userMetricsService.recomputeUserMetrics(userIds));

// 業務の側: 再計算が要る利用者を積む(null・空文字は無視)
markUserDirty(order.userId);

// 入口: 要求の処理を包む(routeFactory は既に包んでいる。自分の入口を作る時だけ)
const response = await runWithUserDirtyTracking(() => handler(request));
```

## API

- `markUserDirty(userId: string | null | undefined): void` — 今の範囲に user_id を積む。範囲の外は何もしない(開発の stage だけ警告を 1 行)
- `runWithUserDirtyTracking<T>(fn): Promise<T>` — 範囲を敷いて `fn` を走らせ、終わり(成功でも throw でも)に集めた user_id を登録された中身へ渡す
- `registerUserDirtyFlushHandler(handler: UserDirtyFlushHandler): void` — 流す中身を足す(足した順に呼ぶ)
- `type UserDirtyFlushHandler = (userIds: string[]) => Promise<void> | void`

## Internals

- 集める場所は要求ごとの `Set`(AsyncLocalStorage)。同じ user_id は 1 回だけ渡る
- 流すのは `finally` の中: `fn` が throw しても集めた分は流す。再計算は元のデータからの冪等な全再計算の前提なので、積みすぎ(コミットされなかった分)は害が無い
- 中身の失敗は握りつぶして記録の 1 行を出す(業務は成功のまま。安全網が補う)
- 集めた物が無い・中身の登録が無い時は何もしない(よく通る道で余計な処理をしない)

## Related

- `src/lib/cacheTags`: 同じ形(要求の範囲に集めてコミットの後に流す)のキャッシュの札の回収口
- `src/domains/core/incrementalRefresh`: 読みのモデルを新しくする道(event-driven の道がこの lib を使う)
