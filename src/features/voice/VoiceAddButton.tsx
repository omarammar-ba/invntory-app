import React, { useRef } from "react";
import { Mic } from "lucide-react";
import SpecularButton from "@/components/effects/SpecularButton";
import { useAppAppearance } from "./useAppAppearance";
import { useVoiceQuota } from "./voice-quota";
import SearchCoachmark from "@/features/dashboard/SearchCoachmark";

export default function VoiceAddButton({
  onClick,
  userId,
  compact = false,
}: {
  onClick: () => void;
  userId?: string;
  compact?: boolean;
}) {
  const quota = useVoiceQuota(userId);
  const { dark, limited } = useAppAppearance();
  const remaining = quota.analysis?.remaining;
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <div className={`voice-entry${compact ? " is-compact" : ""}`}>
      <span ref={ref} className="voice-entry-target">
        <SpecularButton
          className="voice-add-button"
          radius={compact ? 22 : 25}
          size="sm"
          blur={limited ? 0 : 12}
          tint={dark ? "#24272c" : "#ffffff"}
          tintOpacity={0.85}
          textColor={dark ? "#f0f1f4" : "#283747"}
          lineColor={dark ? "#e5ebf4" : "#a8b7c9"}
          baseColor={dark ? "#526073" : "#b7cce4"}
          intensity={0.9}
          idleIntensity={0.55}
          thickness={1.2}
          glow={0.6}
          followMouse={!limited}
          aria-label="إضافة بالصوت"
          title="إضافة بالصوت"
          onClick={onClick}
        >
          <Mic size={26} strokeWidth={1.55} aria-hidden="true" />
        </SpecularButton>
      </span>
      {!compact && remaining != null && (
        <small className="voice-entry-quota">
          آخر رصيد: {remaining} طلب تحليل
        </small>
      )}
      <SearchCoachmark
        targetRef={ref}
        active={false}
        userId={userId}
        storagePrefix="inventory-voice-spotlight-v1"
        title="أضف صنفًا بصوتك"
        description="اضغط المايك واحكِ مواصفات الصنف، ثم اختر صورته وراجع البيانات قبل الحفظ."
      />
    </div>
  );
}
