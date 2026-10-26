import { useCallback, useEffect, useRef, useState } from "react";

// This is the browser's speech service, not a promised Google Cloud connection.
export function useLiveTranscript() {
  const recognition = useRef<any>(null);
  const generation = useRef(0);
  const textRef = useRef("");
  const restartTimer = useRef<ReturnType<typeof setTimeout>>();
  const [text, setText] = useState("");
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState("");
  const supported = Boolean(
    (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition,
  );

  const stop = useCallback(() => {
    generation.current++;
    clearTimeout(restartTimer.current);
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onresult =
        current.onerror =
        current.onend =
        current.onstart =
          null;
      try {
        current.abort();
      } catch {
        /* Already stopped. */
      }
    }
    setAvailable(false);
    return textRef.current;
  }, []);

  const start = useCallback(() => {
    stop();
    textRef.current = "";
    setText("");
    setAvailable(false);
    setStatus("");
    const Constructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Constructor) {
      setStatus(
        "المعاينة المباشرة غير مدعومة هنا. سيظهر نص التسجيل بعد إنهائه.",
      );
      return;
    }
    const id = generation.current;
    let prefix = "",
      restarts = 0,
      fatal = false;
    const launch = () => {
      if (id !== generation.current || document.hidden) return;
      try {
        const current = new Constructor();
        recognition.current = current;
        current.lang = "ar-JO";
        current.continuous = true;
        current.interimResults = true;
        current.maxAlternatives = 1;
        let finalPart = "";
        current.onstart = () => {
          if (id === generation.current) setStatus("");
        };
        current.onresult = (event: any) => {
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
          textRef.current = [prefix, ...all]
            .filter(Boolean)
            .join(" ")
            .slice(0, 4000);
          setText(textRef.current);
          setAvailable(true);
          setStatus("");
        };
        current.onerror = (event: any) => {
          if (id !== generation.current) return;
          fatal = [
            "not-allowed",
            "service-not-allowed",
            "audio-capture",
            "network",
            "language-not-supported",
          ].includes(event.error);
          setAvailable(false);
          setStatus(
            fatal
              ? "المعاينة المباشرة غير متاحة. التسجيل مستمر، وسيظهر نصّه بعد إنهائه."
              : "بانتظار الكلام…",
          );
        };
        current.onend = () => {
          if (id !== generation.current) return;
          setAvailable(false);
          prefix = [prefix, finalPart].filter(Boolean).join(" ");
          if (!fatal && restarts++ < 3)
            restartTimer.current = setTimeout(launch, 300);
          else setStatus("انتهت المعاينة المباشرة. التسجيل مستمر.");
        };
        current.start();
      } catch {
        setStatus("تعذرت المعاينة المباشرة. التسجيل مستمر.");
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
    supported,
    status,
    start,
    stop,
    snapshot: () => textRef.current,
  };
}
