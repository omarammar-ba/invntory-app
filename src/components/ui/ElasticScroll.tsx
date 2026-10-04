import type { ReactNode } from 'react';

interface ElasticScrollProps {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

// Keep native touch scrolling instead of measuring and moving the full page
// during every touch frame at the top and bottom edges.
export function ElasticScroll({ children, className = '' }: ElasticScrollProps) {
  return (
    <div className={`relative min-h-full ${className}`}>
      <div className="w-full">{children}</div>
    </div>
  );
}
