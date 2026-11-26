// src/lib/domain/types/domainConfig.test.ts — pnpm test src/lib/domain/types/domainConfig.test.ts
// 登録の entity.json を JSON の import で読んだ形が DomainConfig に渡せること(型の確かめは pnpm typecheck、ここでは形を見る)
// - 項目ごとに metadataBinding の鍵が違うと、TypeScript は他の項目の鍵を `?: undefined` で足した union にする。
//   metadataBinding の型がそれを受けなければ、domain の設定を渡す所(getDomainConfig の先など)で型の誤りになる

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DomainConfig } from "./domainConfig";
import mixedMetadataBinding from "./mixedMetadataBinding.fixture.json";

test("metadataBinding: 項目ごとに鍵が違う entity.json も DomainConfig に渡せる", () => {
  const config: DomainConfig = mixedMetadataBinding;
  const [video, audio] = config.fields;
  assert.equal(video.metadataBinding?.width, "videoWidth");
  assert.equal(audio.metadataBinding?.width, undefined);
  assert.equal(audio.metadataBinding?.durationSec, "audioDuration");
});
