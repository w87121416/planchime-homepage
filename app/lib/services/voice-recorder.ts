import { createVoiceClip, type VoiceClip } from "./voice-audio.ts";

export interface VoiceCapturePort { capture(progress: (seconds: number) => void): Promise<VoiceClip>; stop(): void; cancel(): void }
export class VoiceRecordingError extends Error {
  readonly code: "cancelled" | "unsupported" | "denied" | "unavailable";
  constructor(code: VoiceRecordingError["code"]) { super(code); this.code = code; }
}
export interface VoiceRecordingRuntime {
  media(): Promise<MediaStream>; context(): AudioContext; node(context: AudioContext): AudioWorkletNode; now(): string;
}
const browserRecordingRuntime = (): VoiceRecordingRuntime => ({
  media: () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new VoiceRecordingError("unsupported");
    return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
  },
  context: () => { if (typeof AudioContext === "undefined") throw new VoiceRecordingError("unsupported"); return new AudioContext(); },
  node: context => new AudioWorkletNode(context, "planchime-voice-capture-v1", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] }),
  now: () => new Date().toISOString(),
});
/** 本机录音资源仅属于一次用户操作；迟到的权限许可不能重新打开已取消的录音。 */
export class BrowserVoiceRecorder implements VoiceCapturePort {
  #epoch = 0; #context: AudioContext | null = null; #stream: MediaStream | null = null;
  #node: AudioWorkletNode | null = null; #source: MediaStreamAudioSourceNode | null = null; #mute: GainNode | null = null;
  #reject: ((reason: unknown) => void) | null = null; #finish: (() => void) | null = null;
  #limit: ReturnType<typeof setTimeout> | undefined; #flush: ReturnType<typeof setTimeout> | undefined;
  private readonly runtime: VoiceRecordingRuntime;
  constructor(runtime: VoiceRecordingRuntime = browserRecordingRuntime()) { this.runtime = runtime; }
  #release() {
    clearTimeout(this.#limit); clearTimeout(this.#flush);
    if (this.#node) { this.#node.port.onmessage = null; this.#node.onprocessorerror = null; this.#node.port.close(); this.#node.disconnect(); }
    this.#source?.disconnect(); this.#mute?.disconnect();
    this.#stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    if (this.#context && this.#context.state !== "closed") void this.#context.close().catch(() => {});
    this.#context = null; this.#stream = null; this.#node = null; this.#source = null; this.#mute = null; this.#finish = null; this.#reject = null;
  }
  cancel() { this.#epoch++; const reject = this.#reject; this.#release(); reject?.(new VoiceRecordingError("cancelled")); }
  stop() {
    if (!this.#node) { this.cancel(); return; }
    // 立即停止麦克风，再收取 worklet 最后一小段；等待超时也不能持续占用录音设备。
    this.#stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.#node.port.postMessage("stop"); clearTimeout(this.#flush); this.#flush = setTimeout(() => this.#finish?.(), 500);
  }
  capture(progress: (seconds: number) => void): Promise<VoiceClip> {
    this.cancel(); const epoch = this.#epoch, referenceInstant = this.runtime.now();
    return new Promise((resolve, reject) => {
      this.#reject = reject; const chunks: Float32Array[] = []; let count = 0;
      const current = () => epoch === this.#epoch;
      const fail = (error: unknown) => {
        if (!current()) return; this.#epoch++; this.#release();
        reject(error instanceof VoiceRecordingError ? error : new VoiceRecordingError(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable"));
      };
      void (async () => {
        try {
          const context = this.runtime.context(); this.#context = context;
          if (!context.audioWorklet) throw new VoiceRecordingError("unsupported");
          // resume 在主动点击的同一调用栈内开始；许可等待后仍逐步核对本次录音代际。
          const resumed = context.resume().then(() => null, error => error);
          const stream = await this.runtime.media();
          if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
          this.#stream = stream; const resumeError = await resumed; if (!current()) return; if (resumeError) throw resumeError;
          await context.audioWorklet.addModule("/audio/planchime-voice-capture.v1.js"); if (!current()) return;
          const node = this.runtime.node(context); this.#node = node;
          const finish = () => {
            if (!current()) return;
            try { const clip = createVoiceClip(chunks, context.sampleRate, referenceInstant); this.#epoch++; this.#release(); resolve(clip); }
            catch (error) { fail(error); }
          };
          this.#finish = finish;
          node.port.onmessage = event => {
            if (!current()) return;
            if (event.data?.type === "done") { finish(); return; }
            if (event.data?.type !== "samples" || !(event.data.data instanceof Float32Array)) { fail(new VoiceRecordingError("unavailable")); return; }
            const chunk = event.data.data as Float32Array;
            if (count + chunk.length > context.sampleRate * 60) { fail(new VoiceRecordingError("unavailable")); return; }
            chunks.push(chunk); count += chunk.length; progress(count / context.sampleRate);
          };
          node.onprocessorerror = () => fail(new VoiceRecordingError("unavailable"));
          this.#source = context.createMediaStreamSource(stream); this.#mute = context.createGain(); this.#mute.gain.value = 0;
          this.#source.connect(node); node.connect(this.#mute); this.#mute.connect(context.destination);
          stream.getTracks().forEach(track => { track.onended = () => this.stop(); });
          progress(0); this.#limit = setTimeout(() => this.stop(), 60_000);
        } catch (error) { fail(error); }
      })();
    });
  }
}
