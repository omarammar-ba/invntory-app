import React from 'react';
import { X } from 'lucide-react';
import { MotionModal } from '@/components/motion/MotionModal';

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ src, onClose }) => {
  return (
    <MotionModal
      backdropClassName="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-0 backdrop-blur-sm md:bg-slate-950/60 md:p-6"
      onClick={onClose}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-[22px] md:border md:border-white/[0.08] md:bg-neutral-950 md:p-3 md:shadow-2xl"
    >
      <div onClick={event => event.stopPropagation()} className="relative flex h-full w-full items-center justify-center md:h-auto">
        <img src={src} alt="معاينة مكبرة" className="max-h-full max-w-full object-contain md:max-h-[82vh] md:rounded-[16px]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 active:scale-95 md:top-4"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </MotionModal>
  );
};

export default ImageModal;