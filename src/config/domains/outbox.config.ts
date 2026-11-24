// src/config/domains/outbox.config.ts
// 送り箱(outbox)の処理の値の上書き(持ち主 src/domains/core/outbox/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: 監視のしきい値を変える `export default { thresholds: { pending: 5000, oldestWaitSeconds: 600 } } satisfies OutboxOverride;`(0 = 見ない)
// 例: 再試行の既定を変える `export default { retry: { maxAttempts: 5, backoff: { baseSeconds: 60, maxSeconds: 7200 } } } satisfies OutboxOverride;`
// 処理の項目ごとの maxAttempts / backoff は項目の隣の <名前>.override.ts(型 2)
import type { OutboxOverride } from "@/domains/outbox/config";

export default {} satisfies OutboxOverride;
