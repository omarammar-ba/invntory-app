import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic } from "lucide-react";
import SearchCoachmark from "@/features/dashboard/SearchCoachmark";

const isTyping = () => {
  const active = document.activeElement;
  return (
    active instanceof HTMLElement &&
    active.matches(
      "textarea, [contenteditable=true], input:not([type]), input:is([type=text],[type=search],[type=email],[type=number],[type=tel],[type=password],[type=url])",
    )
  );
};

export default function StockVoiceLauncher({
  onOpen,
  suppressed,
  userId,
  location = "inventory",
  ready = true,
}: {
  onOpen: () => void;
  suppressed: boolean;
  ready?: boolean;
  userId: string;
  location?: "inventory" | "warehouse";
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState(isTyping);
  useEffect(() => {
    const update = () =>
      setHidden(
        isTyping() ||
          (window.visualViewport
            ? window.innerHeight - window.visualViewport.height > 150
            : false),
      );
    document.addEventListener("focusin", update);
    const onBlur = () => queueMicrotask(update);
    document.addEventListener("focusout", onBlur);
    window.visualViewport?.addEventListener("resize", update);
    update();
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onBlur);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [suppressed]);
  const visible = !hidden && !suppressed;
  return createPortal(
    <>
      <button
        ref={button}
        hidden={!visible}
        className="stock-voice-launcher no-print"
        data-location={location}
        type="button"
        disabled={!ready}
        title={ready ? "مساعد المخزون الصوتي" : "المساعد بانتظار بيانات المخزون"}
        aria-label="مساعد المخزون الصوتي"
        onClick={onOpen}
      >
        <Mic size={22} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {visible && ready && (
        <SearchCoachmark
          targetRef={button}
          active={false}
          userId={userId}
          storagePrefix="inventory-voice-spotlight-v1"
          variant="voice"
          title="جديد: مساعد المخزون"
          description="جرّب تقول: «كم كمية البلاطة 12500؟» لتشوف المتوفر، أو «عدّل الصنف 12500» وبعدين احكِ التغيير. أي تعديل بتراجعه قبل الحفظ."
        />
      )}
    </>, document.body,
  );
}
