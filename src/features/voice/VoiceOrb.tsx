import React, { useLayoutEffect, useRef } from "react";
import { Check, Mic } from "lucide-react";

type OrbState = "idle" | "listening" | "thinking" | "review" | "saving";
type AudioSamples = { push: (samples: Float32Array, rate: number) => void; unavailable: () => void };

export function VoiceOrb({
  state,
  stream,
  onLevel,
  preview,
}: {
  state: OrbState;
  stream?: MediaStream | null;
  onLevel?: (level: number, elapsedMs: number) => void;
  preview?: AudioSamples;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const levelListener = useRef(onLevel);
  levelListener.current = onLevel;
  useLayoutEffect(() => {
    const orb = ref.current;
    if (!orb || !stream || state !== "listening") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!window.AudioContext) {
      preview?.unavailable();
      return;
    }
    let context: AudioContext | undefined;
    let input: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let frame = 0;
    let sampler: ScriptProcessorNode | undefined;
    let sink: GainNode | undefined;
    let resumeTimer: number | undefined;
    try {
      context = new AudioContext();
      input = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      input.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let smooth = 0;
      let sampleStarted: number | undefined;
      const tick = (now: number) => {
        if (!document.hidden && context?.state === "running") {
          sampleStarted ??= now;
          analyser!.getFloatTimeDomainData(samples);
          const power = Math.sqrt(
            samples.reduce((sum, sample) => sum + sample * sample, 0) /
              samples.length,
          );
          smooth += (Math.min(1, power * 6) - smooth) * 0.18;
          if (!reduced.matches) orb.style.setProperty("--mic-level", smooth.toFixed(3));
          levelListener.current?.(power, now - sampleStarted);
        }
        frame = requestAnimationFrame(tick);
      };
      void context.resume().catch(() => {});
      frame = requestAnimationFrame(tick);
      if (preview) {
        // The recorder has already started. Tap only the meter's existing audio graph.
        sampler = context.createScriptProcessor(4096, 1, 1);
        sink = context.createGain();
        sink.gain.value = 0;
        sampler.onaudioprocess = event => {
          if (!document.hidden)
            preview.push(event.inputBuffer.getChannelData(0), event.inputBuffer.sampleRate);
        };
        input.connect(sampler);
        sampler.connect(sink);
        sink.connect(context.destination);
        resumeTimer = window.setTimeout(() => {
          if (context?.state !== "running") preview.unavailable();
        }, 4000);
      }
    } catch {
      // Recording continues even if the device cannot animate the level.
      preview?.unavailable();
    }
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer);
      if (sampler) {
        sampler.onaudioprocess = null;
        sampler.disconnect();
      }
      sink?.disconnect();
      input?.disconnect();
      analyser?.disconnect();
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      orb.style.removeProperty("--mic-level");
    };
  }, [state, stream, preview]);
  return (
    <span
      ref={ref}
      className="stock-voice-orb"
      data-state={state}
      aria-hidden="true"
    >
      <span className="stock-voice-wave" />
      <span className="stock-voice-wave" />
      <span className="stock-voice-core">
        {state === "review" ? (
          <Check size={26} />
        ) : (
          <Mic size={26} strokeWidth={1.75} />
        )}
      </span>
    </span>
  );
}
