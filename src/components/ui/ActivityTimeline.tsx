import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Bookmark, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, LogEntry } from '@/types';
import { getLogDate, getLogTone, getQuantityChange, relativeLogTime } from '@/features/dashboard/dashboardModel';

export default function ActivityTimeline({ logs, categories = [], onViewModelLogs }: {
  logs: LogEntry[]; categories?: Category[]; onViewModelLogs?: (name: string, categoryId?: string) => void;
}) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const resultId = useId();
  const reduceMotion = useReducedMotion();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  return <ol className="home-timeline">{logs.map((log, index) => {
          const key = log.id || String(index);
          const tone = getLogTone(log.action || '');
          const Icon = tone === 'rose' ? Trash2 : tone === 'amber' ? Bookmark : tone === 'teal' ? Plus : Pencil;
          const date = getLogDate(log.timestamp);
          const change = getQuantityChange(log.details || '');
          const category = categories.find(entry => entry.id === log.categoryId);
          const actor = log.user?.split('@')[0] || 'مستخدم';
          const expanded = expandedLog === key;
          const detailId = `${resultId}-log-${index}`;
          return <li className={`home-event home-event-${tone}`} key={key} style={{ '--event-order': Math.min(index, 5) } as React.CSSProperties}>
            <span className="home-event-node" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
            <div className="home-event-content">
              <div className="home-event-heading"><strong>{actor}<span>{log.action || 'حركة مخزون'}</span></strong><time dateTime={date?.toISOString()} title={date?.toLocaleString('ar-JO')}>{relativeLogTime(date, now)}</time>
                <button type="button" className="home-event-toggle" aria-label={`${expanded ? 'إخفاء' : 'عرض'} تفاصيل حركة ${log.tileName || ''}`} aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedLog(expanded ? null : key)}><ChevronLeft size={16} className={expanded ? 'is-open' : ''} /></button>
              </div>
              <div className="home-event-meta">{log.tileName && (onViewModelLogs ? <button type="button" className="home-item-link" aria-label={`عرض تفاصيل الصنف ${log.tileName}`} onClick={() => onViewModelLogs(log.tileName, log.categoryId)}><bdi>{log.tileName}</bdi></button> : <bdi className="home-item-code">{log.tileName}</bdi>)}
                {change ? <span className="home-quantity-pill"><span>من</span><bdi>{change.before}</bdi><ArrowLeft size={12} aria-hidden="true" /><span className="sr-only">إلى</span><bdi>{change.after}</bdi>{category?.defaultUnit === 'pieces' ? 'قطعة' : category?.defaultUnit === 'meters' ? 'م²' : ''}</span>
                  : log.details && <span className="home-event-preview">{log.details}</span>}
              </div>
              <AnimatePresence initial={false}>{expanded && <motion.div id={detailId} className="home-event-details" initial={{ opacity: 0, height: reduceMotion ? 'auto' : 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: reduceMotion ? 'auto' : 0 }}>
                <p>{log.details || 'لا توجد تفاصيل إضافية لهذه الحركة.'}</p><small>{category?.name}{category && date ? ' · ' : ''}{date?.toLocaleString('ar-JO')}</small>
                {log.tileName && onViewModelLogs && <button type="button" className="home-text-button" onClick={() => onViewModelLogs?.(log.tileName, log.categoryId)}>عرض تفاصيل الصنف<ChevronLeft size={14} /></button>}
              </motion.div>}</AnimatePresence>
            </div>
          </li>;
        })}</ol>;
}
