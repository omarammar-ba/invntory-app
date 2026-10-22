import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ src, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(<dialog ref={ref} className="inventory-image-dialog" aria-label="معاينة صورة الصنف" dir="rtl"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {failed ? <p role="status">تعذر عرض الصورة. أغلق المعاينة وحاول مجددًا.</p> : <motion.img key={src} src={src} alt="معاينة مكبرة" onError={() => setFailed(true)}
      initial={reduceMotion ? false : { opacity: .4, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .18 }} />}
    <button type="button" className="inventory-image-close" onClick={onClose} aria-label="إغلاق الصورة" autoFocus><X size={23} /></button>
  </dialog>, document.body);
};

export default ImageModal;
