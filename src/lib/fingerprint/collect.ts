// src/lib/fingerprint/collect.ts
//
// デバイス信号の収集（ブラウザ専用）。
// 各成分は個別 try-catch で fail-soft: 取得できない成分は null になり全体は失敗しない。
// Safari / Brave / Firefox(RFP) は Canvas 等に意図的ノイズを注入するため、
// 成分別ハッシュは「完全一致すれば強い証拠、不一致でも別人とは限らない」性質を持つ
// （照合側は成分一致数のスコアリングで扱う）。

import { hashString, hashValue } from "./hash";
import {
  FINGERPRINT_SIGNALS_VERSION,
  type DeviceSignals,
  type FingerprintComponentHashes,
  type FingerprintPayload,
} from "./types";

async function safe<T>(fn: () => T | Promise<T>): Promise<T | null> {
  try {
    const value = await fn();
    return value ?? null;
  } catch {
    return null;
  }
}

function collectCanvas(): Promise<string | null> {
  return safe(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // フォントレンダリング・アンチエイリアス・絵文字合成の個体差が出る描画
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(100, 5, 80, 30);
    ctx.fillStyle = "#069";
    ctx.font = "13px Arial";
    ctx.fillText("Cwm fjordbank glyphs vext quiz, \u{1F600}\u{1F98A}", 4, 20);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.font = "16px Georgia";
    ctx.fillText("Cwm fjordbank glyphs vext quiz, \u{1F600}\u{1F98A}", 6, 40);
    const gradient = ctx.createLinearGradient(0, 0, 240, 60);
    gradient.addColorStop(0, "#ff0000");
    gradient.addColorStop(0.5, "#00ff00");
    gradient.addColorStop(1, "#0000ff");
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.arc(120, 30, 20, 0, Math.PI * 1.5);
    ctx.stroke();
    return hashString(canvas.toDataURL());
  });
}

function collectWebgl(): Promise<DeviceSignals["webgl"]> {
  return safe(async () => {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));

    const paramKeys = [
      gl.MAX_TEXTURE_SIZE,
      gl.MAX_RENDERBUFFER_SIZE,
      gl.MAX_VIEWPORT_DIMS,
      gl.MAX_VERTEX_ATTRIBS,
      gl.MAX_VERTEX_UNIFORM_VECTORS,
      gl.MAX_FRAGMENT_UNIFORM_VECTORS,
      gl.MAX_VARYING_VECTORS,
      gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
      gl.ALIASED_LINE_WIDTH_RANGE,
      gl.ALIASED_POINT_SIZE_RANGE,
    ];
    const params = paramKeys.map((key) => {
      const value = gl.getParameter(key);
      // Int32Array / Float32Array は配列化して安定シリアライズ可能にする
      return ArrayBuffer.isView(value) ? Array.from(value as unknown as ArrayLike<number>) : value;
    });
    const extensions = gl.getSupportedExtensions()?.slice().sort() ?? [];

    return {
      vendor,
      renderer,
      paramsHash: await hashValue({ params, extensions }),
    };
  });
}

function collectAudio(): Promise<string | null> {
  return safe(async () => {
    const OfflineCtx =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!OfflineCtx) return null;

    // 短いオシレータ + コンプレッサをオフラインレンダリングし、
    // DSP 実装差（OS / ブラウザ / CPU）を波形サマリーとして取り出す
    const ctx = new OfflineCtx(1, 5000, 44100);
    const oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 10000;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;
    oscillator.connect(compressor);
    compressor.connect(ctx.destination);
    oscillator.start(0);

    const buffer = await ctx.startRendering();
    const samples = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 4000; i < samples.length; i++) sum += Math.abs(samples[i]);
    return hashString(sum.toFixed(6));
  });
}

/** 検出対象フォント。OS 判別に効く代表的なプリインストールフォント群 */
const FONT_CANDIDATES = [
  "Arial Black",
  "Arial Narrow",
  "Calibri",
  "Cambria",
  "Comic Sans MS",
  "Consolas",
  "Courier New",
  "Franklin Gothic Medium",
  "Futura",
  "Garamond",
  "Geneva",
  "Georgia",
  "Gill Sans",
  "Helvetica Neue",
  "Hiragino Kaku Gothic ProN",
  "Hiragino Mincho ProN",
  "Impact",
  "Lucida Console",
  "Lucida Grande",
  "MS Gothic",
  "MS PGothic",
  "Meiryo",
  "Menlo",
  "Monaco",
  "Noto Sans CJK JP",
  "Optima",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Trebuchet MS",
  "Verdana",
  "Yu Gothic",
  "Yu Mincho",
];

function collectFonts(): Promise<string[] | null> {
  return safe(() => {
    const baseFonts = ["monospace", "sans-serif", "serif"];
    const testString = "mmmMMMwwwlliI10@%あ漢";
    const testSize = "72px";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const measure = (font: string): number => {
      ctx.font = `${testSize} ${font}`;
      return ctx.measureText(testString).width;
    };
    const baseWidths = new Map(baseFonts.map((base) => [base, measure(base)]));

    const detected: string[] = [];
    for (const candidate of FONT_CANDIDATES) {
      const available = baseFonts.some(
        (base) => measure(`'${candidate}', ${base}`) !== baseWidths.get(base),
      );
      if (available) detected.push(candidate);
    }
    return detected;
  });
}

function collectCodecs(): Promise<Record<string, string | boolean> | null> {
  return safe(() => {
    const video = document.createElement("video");
    const audio = document.createElement("audio");
    const result: Record<string, string | boolean> = {
      h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
      hevc: video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.90"'),
      vp9: video.canPlayType('video/webm; codecs="vp9"'),
      av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"'),
      ogg: audio.canPlayType('audio/ogg; codecs="vorbis"'),
      aac: audio.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
      flac: audio.canPlayType("audio/flac"),
    };
    if (typeof MediaRecorder !== "undefined") {
      result.recWebm = MediaRecorder.isTypeSupported("video/webm;codecs=vp9");
      result.recMp4 = MediaRecorder.isTypeSupported("video/mp4");
    }
    return result;
  });
}

function collectMath(): Promise<string | null> {
  return safe(() => {
    // JS エンジン / libm 実装の丸め癖。数値を文字列化してまとめてハッシュ
    const values = [
      Math.tan(-1e300),
      Math.sin(1e300),
      Math.cos(1e300),
      Math.log(Math.E + 1e-15),
      Math.exp(1),
      Math.sinh(1),
      Math.acosh(1e308),
      Math.atan2(0.5, 2),
      Math.pow(Math.PI, -100),
    ];
    return hashString(values.map((v) => v.toString()).join("|"));
  });
}

type UADataBrand = { brand: string; version: string };
type NavigatorUAData = {
  brands?: UADataBrand[];
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
};

function collectUaData(): Promise<DeviceSignals["uaData"]> {
  return safe(async () => {
    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
    if (!uaData) return null;
    const high = (await uaData.getHighEntropyValues?.([
      "platform",
      "platformVersion",
      "architecture",
      "model",
      "bitness",
    ])) ?? {};
    return {
      brands: uaData.brands?.map((b) => `${b.brand} ${b.version}`) ?? null,
      platform: (high.platform as string) ?? null,
      platformVersion: (high.platformVersion as string) ?? null,
      architecture: (high.architecture as string) ?? null,
      model: (high.model as string) ?? null,
      bitness: (high.bitness as string) ?? null,
    };
  });
}

/**
 * デバイス信号を収集する（ブラウザ専用・非同期）。
 * SSR 文脈で呼ばれた場合は全成分 null の骨格を返す。
 */
export async function collectDeviceSignals(): Promise<DeviceSignals> {
  const empty: DeviceSignals = {
    version: FINGERPRINT_SIGNALS_VERSION,
    canvas: null,
    webgl: null,
    audio: null,
    fonts: null,
    screen: null,
    timezone: null,
    languages: null,
    platform: null,
    hardware: null,
    uaData: null,
    codecs: null,
    math: null,
  };
  if (typeof window === "undefined" || typeof document === "undefined") return empty;

  const [canvas, webgl, audio, fonts, codecs, math, uaData] = await Promise.all([
    collectCanvas(),
    collectWebgl(),
    collectAudio(),
    collectFonts(),
    collectCodecs(),
    collectMath(),
    collectUaData(),
  ]);

  return {
    ...empty,
    canvas,
    webgl,
    audio,
    fonts,
    codecs,
    math,
    uaData,
    screen: await safe(() => ({
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      dpr: window.devicePixelRatio ?? 1,
    })),
    timezone: await safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    languages: await safe(() => [...navigator.languages]),
    platform: await safe(() => navigator.platform || null),
    hardware: await safe(() => ({
      concurrency: navigator.hardwareConcurrency ?? null,
      memory:
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      touchPoints: navigator.maxTouchPoints ?? null,
    })),
  };
}

/** 信号から検索軸となる成分別ハッシュ / 可読キーを導出する */
export async function buildComponentHashes(
  signals: DeviceSignals,
): Promise<FingerprintComponentHashes> {
  const { canvas, webgl, audio, fonts, screen, timezone, languages, platform, hardware } = signals;
  return {
    canvas,
    webgl: webgl ? await hashValue([webgl.vendor, webgl.renderer, webgl.paramsHash]) : null,
    audio,
    fonts: fonts && fonts.length > 0 ? await hashValue(fonts) : null,
    screen: screen ? `${screen.width}x${screen.height}x${screen.colorDepth}@${screen.dpr}` : null,
    timezone,
    languages: languages && languages.length > 0 ? languages.join(",").slice(0, 256) : null,
    platform,
    hardware: hardware
      ? `c${hardware.concurrency ?? "-"}/m${hardware.memory ?? "-"}/t${hardware.touchPoints ?? "-"}`
      : null,
  };
}

/** 収集から ingest 用 payload の組み立てまでを一括で行う */
export async function collectFingerprintPayload(): Promise<FingerprintPayload> {
  const signals = await collectDeviceSignals();
  const componentHashes = await buildComponentHashes(signals);
  return {
    version: FINGERPRINT_SIGNALS_VERSION,
    componentHashes,
    webglRenderer: signals.webgl?.renderer ?? null,
    rawSignals: signals,
  };
}
