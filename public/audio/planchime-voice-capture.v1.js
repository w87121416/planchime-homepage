/* global AudioWorkletProcessor, sampleRate, registerProcessor */
// 音频线程只做本机采集，最长 60 秒；没有网络、文件或浏览器存储访问。
class PlanChimeVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.buffer = new Float32Array(2048); this.used = 0; this.count = 0; this.done = false;
    this.port.onmessage = event => { if (event.data === 'stop') this.finish(); };
  }
  flush() {
    if (!this.used) return;
    const data = this.buffer.slice(0, this.used); this.port.postMessage({ type: 'samples', data }, [data.buffer]); this.used = 0;
  }
  finish() { if (this.done) return; this.done = true; this.flush(); this.port.postMessage({ type: 'done' }); }
  process(inputs) {
    if (this.done) return false;
    const channels = inputs[0]; if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      if (this.count >= sampleRate * 60) { this.finish(); return false; }
      let value = 0; for (const channel of channels) value += channel[i] ?? 0;
      this.buffer[this.used++] = value / channels.length; this.count++;
      if (this.used === this.buffer.length) this.flush();
    }
    return true;
  }
}
registerProcessor('planchime-voice-capture-v1', PlanChimeVoiceCapture);
