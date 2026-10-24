import React, { useRef } from 'react';
import { Mic } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useVoiceQuota } from './voice-quota';
import SearchCoachmark from '@/features/dashboard/SearchCoachmark';
export default function VoiceAddButton({ onClick, userId }: { onClick: () => void; userId?: string }) {
  const quota=useVoiceQuota(userId);const reduceMotion=useReducedMotion();
  const remaining=quota.analysis?.remaining;
  const ref = useRef<HTMLButtonElement>(null);
  return <><motion.button whileTap={reduceMotion ? undefined : {scale:0.97}} ref={ref} className="voice-add-button home-secondary-button" aria-label="إضافة بالصوت" type="button" onClick={onClick}><span className="voice-button-symbol"><Mic size={22} strokeWidth={1.6} /></span><span className="voice-button-label">إضافة بالصوت<small>{remaining != null ? `آخر رصيد: ${remaining} طلب تحليل` : ''}</small></span></motion.button>
    <SearchCoachmark targetRef={ref} active={false} userId={userId} storagePrefix="inventory-voice-spotlight-v1" title="أضف صنفًا بصوتك" description="اضغط المايك واحكِ مواصفات الصنف، ثم اختر صورته وراجع البيانات قبل الحفظ." />
  </>;
}
