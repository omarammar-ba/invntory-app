import { auth } from "@/services/firebase";
import { inventoryTranscriptionHint, prepareInventoryTranscript } from "../../../voice-api/src/inventory-transcript.mjs";

const SAMPLE_RATE = 16000;
const MAX_SAMPLES = SAMPLE_RATE * 45;
const GAPS = [1.8, 4, 8];

export async function transcribeVoicePreview(audio: Blob, signal: AbortSignal): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in user");
  const endpoint = String(import.meta.env.VITE_VOICE_API_URL || "").trim();
  const body = new FormData();
  if (endpoint) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("Invalid preview endpoint");
    body.set("mode", "transcribe-preview");
    body.set("audio", audio, "preview.wav");
    const token = await user.getIdToken();
    if (signal.aborted) return "";
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body, signal });
    if (!response.ok) throw new Error("Voice preview unavailable");
    const result = await response.json();
    return typeof result.transcript === "string" ? result.transcript.slice(0, 4000) : "";
  }
  // Reuse the opt-in local Groq test settings, without changing final analysis.
  const key = import.meta.env.VITE_VOICE_DIRECT_TEST === "true" && String(import.meta.env.VITE_GROQ_TEST_KEY || "").trim();
  if (!key) throw new Error("Voice preview not configured");
  body.set("file", audio, "preview.wav");
  body.set("model", "whisper-large-v3-turbo");
  body.set("temperature", "0");
  body.set("response_format", "json");
  body.set("prompt", inventoryTranscriptionHint);
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body, signal,
  });
  if (!response.ok) throw new Error("Voice preview unavailable");
  const result = await response.json();
  return typeof result.text === "string" ? prepareInventoryTranscript(result.text.slice(0, 4000)) : "";
}

function wav(samples: Int16Array, count: number) {
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']] as const)
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  view.setUint32(4, buffer.byteLength - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, samples[i], true);
  return new Blob([buffer], { type: 'audio/wav' });
}

export function createVoicePreview(
  transcribe: (audio: Blob, signal: AbortSignal) => Promise<string>,
  show: (text: string) => void,
  unavailable: () => void,
) {
  const pcm = new Int16Array(MAX_SAMPLES);
  let closed = false;
  let pending: AbortController | undefined;
  let count = 0, position = 0, sum = 0, sourceSamples = 0;
  let lastSent = 0, speech = 0, requests = 0, busy = false;

  return {
    stop() {
      closed = true;
      pending?.abort();
    },
    push(input: Float32Array, rate: number) {
      if (closed || requests >= GAPS.length || count >= MAX_SAMPLES) return;
      let power = 0;
      for (const sample of input) {
        power += sample * sample;
        position += SAMPLE_RATE;
        sum += sample;
        sourceSamples++;
        if (position >= rate) {
          position -= rate;
          pcm[count++] = Math.round(Math.max(-1, Math.min(1, sum / sourceSamples)) * 32767);
          sum = sourceSamples = 0;
          if (count === MAX_SAMPLES) break;
        }
      }
      if (Math.sqrt(power / input.length) > 0.004) speech += input.length / rate;
      if (busy || speech < 0.6 || count - lastSent < GAPS[requests] * SAMPLE_RATE) return;

      // Cumulative clips let Whisper revise a word cut off in an earlier preview.
      lastSent = count;
      speech = 0;
      requests++;
      busy = true;
      const request = new AbortController();
      pending = request;
      const timeout = window.setTimeout(() => request.abort(), 8000);
      void transcribe(wav(pcm, count), request.signal)
        .then(text => { if (!closed && !request.signal.aborted && text.trim()) show(text); })
        .catch(() => {
          if (!closed) unavailable();
          closed = true;
        })
        .finally(() => {
          clearTimeout(timeout);
          pending = undefined;
          busy = false;
        });
    },
  };
}
