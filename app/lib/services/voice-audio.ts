import { PurchaseClientError } from "../purchase/protocol.ts";

export const VOICE_SAMPLE_RATE = 16_000, VOICE_MAX_SECONDS = 60, VOICE_MAX_SAMPLES = 960_000;
export type VoiceClip = Readonly<{ wav: Uint8Array; sampleCount: number; seconds: number; units: number; referenceInstant: string }>;
const invalid = (): never => { throw new PurchaseClientError("PRO_VOICE_AUDIO_INVALID"); };
/** 先按真实采样率重采样，再写唯一的 44 字节 PCM WAV 头；不信任容器上报的时长。 */
export function createVoiceClip(chunks: readonly Float32Array[], sourceRate: number, referenceInstant: string): VoiceClip {
  if (!Number.isInteger(sourceRate) || sourceRate < 8000 || sourceRate > 192000) invalid();
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (total < 1 || total > sourceRate * VOICE_MAX_SECONDS) invalid();
  const input = new Float32Array(total); let offset = 0;
  for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }
  if (input.some(value => !Number.isFinite(value))) invalid();
  const sampleCount = Math.floor(total * VOICE_SAMPLE_RATE / sourceRate);
  if (sampleCount < 1 || sampleCount > VOICE_MAX_SAMPLES) invalid();
  const wav = new Uint8Array(44 + sampleCount * 2), view = new DataView(wav.buffer);
  const ascii = (start: number, value: string) => { for (let i = 0; i < value.length; i++) wav[start + i] = value.charCodeAt(i); };
  ascii(0, "RIFF"); view.setUint32(4, wav.length - 8, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, VOICE_SAMPLE_RATE, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, "data"); view.setUint32(40, sampleCount * 2, true);
  const ratio = sourceRate / VOICE_SAMPLE_RATE;
  for (let i = 0; i < sampleCount; i++) {
    // 面积平均减轻降采样混叠；低采样率也按区间比例处理，不通过改 WAV 头伪装 16k。
    const start = i * ratio, end = Math.min((i + 1) * ratio, total); let sum = 0;
    for (let j = Math.floor(start); j < Math.ceil(end); j++) sum += input[j] * (Math.min(end, j + 1) - Math.max(start, j));
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return Object.freeze({ wav, sampleCount, seconds: sampleCount / VOICE_SAMPLE_RATE, units: Math.ceil(sampleCount / VOICE_SAMPLE_RATE), referenceInstant });
}
export function voiceWavBase64(wav: Uint8Array): string {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength), ascii = (at: number, n: number) => String.fromCharCode(...wav.subarray(at, at + n));
  if (wav.length < 46 || wav.length > 1_920_044 || (wav.length - 44) % 2 || ascii(0, 4) !== "RIFF" || view.getUint32(4, true) !== wav.length - 8 ||
      ascii(8, 4) !== "WAVE" || ascii(12, 4) !== "fmt " || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 ||
      view.getUint32(24, true) !== 16000 || view.getUint32(28, true) !== 32000 || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 ||
      ascii(36, 4) !== "data" || view.getUint32(40, true) !== wav.length - 44) invalid();
  let binary = "";
  for (let offset = 0; offset < wav.length; offset += 8192) binary += String.fromCharCode(...wav.subarray(offset, offset + 8192));
  return btoa(binary);
}
