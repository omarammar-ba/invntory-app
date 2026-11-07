import { useCallback, useEffect, useRef, useState } from "react";

export function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const IOS_RELEASE_DELAY_MS = 220;
let pendingAcquisition: Promise<unknown> | null = null;
let lastRelease = -Infinity;

function cancellation() {
  return new DOMException("Recording cancelled", "AbortError");
}

function releaseStream(media: MediaStream) {
  media.getTracks().forEach(track => track.stop());
  lastRelease = performance.now();
}

function waitForInput(track: MediaStreamTrack, signal: AbortSignal) {
  if (signal.aborted || track.readyState !== "live") return Promise.resolve(false);
  if (!track.muted) return Promise.resolve(true);
  return new Promise<boolean>(resolve => {
    const finish = (usable: boolean) => {
      window.clearTimeout(timer);
      track.removeEventListener("unmute", unmute);
      track.removeEventListener("ended", end);
      signal.removeEventListener("abort", end);
      resolve(usable);
    };
    const unmute = () => finish(track.readyState === "live");
    const end = () => finish(false);
    const timer = window.setTimeout(end, 1200);
    track.addEventListener("unmute", unmute, { once: true });
    track.addEventListener("ended", end, { once: true });
    signal.addEventListener("abort", end, { once: true });
  });
}

export function requestVoiceCapture() {
  const abort = new AbortController();
  const ios = isAppleMobile();
  let stream: MediaStream | undefined;
  const previous = pendingAcquisition;
  const release = () => {
    if (!stream) return;
    releaseStream(stream);
    stream = undefined;
  };
  const acquire = async () => {
    const releaseDelay = ios ? IOS_RELEASE_DELAY_MS - (performance.now() - lastRelease) : 0;
    if (releaseDelay > 0) await new Promise(resolve => window.setTimeout(resolve, releaseDelay));
    if (abort.signal.aborted) throw cancellation();
    const media = await navigator.mediaDevices.getUserMedia({
      audio: ios ? true : { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (abort.signal.aborted) {
      releaseStream(media);
      throw cancellation();
    }
    stream = media;
    const track = media.getAudioTracks()[0];
    if (track && await waitForInput(track, abort.signal) && !abort.signal.aborted) return media;
    release();
    if (abort.signal.aborted) throw cancellation();
    return null;
  };

  // First acquisition starts in the click. A rapid reopen queues behind any
  // unresolved acquisition so a late permission result cannot steal the mic.
  const promise = (async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw new Error("التسجيل يحتاج متصفحًا يدعم المايك واتصالًا آمنًا.");
    if (previous) await previous.catch(() => {});
    const media = await acquire();
    if (media) return media;
    if (ios) {
      const retry = await acquire();
      if (retry) return retry;
    }
    throw new Error("المايك مفتوح لكن ما وصل صوت من الجهاز. اضغط ابدأ التسجيل وحاول مرة ثانية.");
  })();
  pendingAcquisition = promise;
  const clearPending = () => {
    if (pendingAcquisition === promise) pendingAcquisition = null;
  };
  void promise.then(clearPending, clearPending);

  return {
    promise,
    cancel() {
      abort.abort();
      release();
    },
  };
}

export type VoiceCapture = ReturnType<typeof requestVoiceCapture>;

export function useVoiceLaunch() {
  const [capture, setCapture] = useState<VoiceCapture | null>(null);
  const current = useRef<VoiceCapture | null>(null);
  const openVoice = useCallback(() => {
    if (current.current) return;
    current.current = requestVoiceCapture();
    setCapture(current.current);
  }, []);
  const closeVoice = useCallback(() => {
    current.current?.cancel();
    current.current = null;
    setCapture(null);
  }, []);
  useEffect(() => () => {
    current.current?.cancel();
    current.current = null;
  }, []);
  return { capture, voiceOpen: capture !== null, openVoice, closeVoice };
}
