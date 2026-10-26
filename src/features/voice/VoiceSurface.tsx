import React from "react";
import { VoiceBeam } from "voice-glow";
import { ThinkingOrb } from "thinking-orbs";
import { useReducedMotion } from "motion/react";
import { Mic } from "lucide-react";
import { useAppAppearance } from "./useAppAppearance";

export default function VoiceSurface({
  stream,
  recording,
  processing,
  phase,
  children,
}: {
  stream: MediaStream | null;
  recording: boolean;
  processing: boolean;
  phase: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const { dark, limited } = useAppAppearance();
  const immersive = recording || processing;
  const label =
    phase === "extracting"
      ? "ترتيب بيانات الصنف…"
      : phase === "processing"
        ? "معالجة التسجيل…"
        : "تحويل الصوت إلى نص…";
  return (
    <VoiceBeam
      className={`voice-beam-host${immersive ? " is-immersive" : ""}`}
      type="default"
      stream={recording ? stream : null}
      colorVariant="ocean"
      theme={dark ? "dark" : "light"}
      active={recording && !limited}
      paused={!!reduce}
      strength={limited ? 0 : 0.6}
      idle={0}
      staticColors
      reach={0.95}
    >
      <div className={`voice-surface${immersive ? " is-immersive" : ""}`}>
        {processing ? (
          <div className="voice-processing" role="status">
            <ThinkingOrb
              state={
                phase === "extracting"
                  ? "solving"
                  : phase === "processing"
                    ? "working"
                    : "searching"
              }
              size={64}
              theme={dark ? "dark" : "light"}
              color={dark ? "#acd1ff" : "#286ab5"}
              paused={!!reduce}
              speed={0.8}
              aria-hidden="true"
            />
            <p>{label}</p>
          </div>
        ) : (
          !recording && (
            <span className="voice-surface-mic" aria-hidden="true">
              <Mic size={28} strokeWidth={1.5} />
            </span>
          )
        )}
        {children}
      </div>
    </VoiceBeam>
  );
}
