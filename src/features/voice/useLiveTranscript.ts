import { useCallback, useEffect, useRef, useState } from "react";
import { isAppleMobile } from "./voice-capture";
import { prepareInventoryTranscript } from "../../../voice-api/src/inventory-transcript.mjs";

type Result = { isFinal: boolean; 0?: { transcript?: string } };
type SpeechSession = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: (track?: MediaStreamTrack) => void;
  abort: () => void;
};
type SpeechConstructor = { new (): SpeechSession; prototype: SpeechSession };
const browser = window as Window & {
  SpeechRecognition?: SpeechConstructor;
  webkitSpeechRecognition?: SpeechConstructor;
};

function joinTranscript(prefix: string, segment: string) {
  const earlier = prefix.split(/\s+/).filter(Boolean);
  const next = segment.split(/\s+/).filter(Boolean);
  let overlap = Math.min(earlier.length, next.length);
  while (overlap && earlier.slice(-overlap).join(" ") !== next.slice(0, overlap).join(" ")) overlap--;
  return [...earlier, ...next.slice(overlap)].join(" ");
}

// This is the browser's speech service, not a promised Google Cloud connection.
export function useLiveTranscript() {
  const recognition = useRef<SpeechSession | null>(null);
  const generation = useRef(0);
  const textRef = useRef("");
  const restartTimer = useRef<ReturnType<typeof setTimeout>>();
  const [text, setText] = useState("");
  const [available, setAvailable] = useState(false);

  const stop = useCallback(() => {
    generation.current++;
    clearTimeout(restartTimer.current);
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onresult =
        current.onerror =
        current.onend = null;
      try {
        current.abort();
      } catch {
        /* Already stopped. */
      }
    }
    setAvailable(false);
    return textRef.current;
  }, []);

  const start = useCallback((track: MediaStreamTrack) => {
    stop();
    textRef.current = "";
    setText("");
    setAvailable(false);
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    // iPhone/iPad recognition can open a second native microphone session.
    // Keep MediaRecorder as the sole owner there; transcribe the file on stop.
    if (!Constructor || isAppleMobile()) return;
    // Where supported, read the existing recording track. Older engines accept
    // only start(); the preview remains optional and cannot cancel recording.
    const sharedTrack = "processLocally" in Constructor.prototype;
    const id = generation.current;
    let prefix = "",
      restarts = 0,
      fatal = false;
    const launch = () => {
      if (id !== generation.current || document.hidden || track.readyState !== "live") return;
      try {
        const current = new Constructor();
        recognition.current = current;
        current.lang = "ar-JO";
        current.continuous = true;
        current.interimResults = true;
        current.maxAlternatives = 1;
        let finalPart = "";
        current.onresult = (event) => {
          if (id !== generation.current) return;
          const all: string[] = [],
            final: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            const segment = String(
              event.results[i]?.[0]?.transcript || "",
            ).trim();
            if (segment) {
              all.push(segment);
              if (event.results[i].isFinal) final.push(segment);
            }
          }
          finalPart = final.join(" ");
          textRef.current = prepareInventoryTranscript(joinTranscript(prefix, all.join(" "))).slice(0, 4000);
          setText(textRef.current);
          setAvailable(true);
        };
        current.onerror = (event) => {
          if (id !== generation.current) return;
          fatal = [
            "not-allowed",
            "service-not-allowed",
            "audio-capture",
            "network",
            "language-not-supported",
          ].includes(event.error);
          setAvailable(false);
        };
        current.onend = () => {
          if (id !== generation.current) return;
          setAvailable(false);
          prefix = joinTranscript(prefix, finalPart);
          if (!fatal && restarts++ < 3)
            restartTimer.current = setTimeout(launch, 300);
        };
        if (sharedTrack) {
          try { current.start(track); }
          catch (error) {
            if (!(error instanceof TypeError) &&
                !(error instanceof DOMException && error.name === "NotSupportedError")) throw error;
            current.start();
          }
        } else current.start();
      } catch {
        setAvailable(false);
      }
    };
    launch();
  }, [stop]);
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );
  return {
    text,
    available,
    start,
    stop,
    snapshot: () => textRef.current,
  };
}
