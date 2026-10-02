import React from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import {
  AppBottomSheet,
  AppBottomSheetSnap,
} from './AppBottomSheet';
import { DesktopDialog } from './DesktopDialog';

export interface ResponsiveOverlayProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  title?: string;
  mobileSnap?: AppBottomSheetSnap;
  desktopMaxWidth?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export const ResponsiveOverlay: React.FC<
  ResponsiveOverlayProps
> = ({
  open,
  onClose,
  onExited,
  title,
  mobileSnap = 'expanded',
  desktopMaxWidth = 'max-w-2xl',
  contentClassName,
  children,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <AppBottomSheet
        open={open}
        onClose={onClose}
        onExited={onExited}
        title={title}
        initialSnap={mobileSnap}
        contentClassName={contentClassName}
      >
        {children}
      </AppBottomSheet>
    );
  }

  return (
    <DesktopDialog
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={title}
      maxWidth={desktopMaxWidth}
      contentClassName={contentClassName}
    >
      {children}
    </DesktopDialog>
  );
};
