import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';

interface ResizableThProps {
  children?: React.ReactNode;
  className?: string;
  onResize: (newWidth: number) => void;
  width: number;
  minWidth?: number;
}

export const ResizableTh: React.FC<ResizableThProps> = ({
  children,
  className,
  onResize,
  width,
  minWidth = 60,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const newWidth = startWidth.current + (e.clientX - startX.current);
      onResize(Math.max(minWidth, newWidth));
    });
  }, [onResize, minWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [handleMouseMove]);

  // Clean up listeners if component unmounts during a resize
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <th
      className={cn('relative group select-none', className)}
      style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
    >
      <div className="flex items-center gap-2 h-full">{children}</div>
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-daiichi-red/50 transition-colors',
          isResizing && 'bg-daiichi-red w-0.5'
        )}
      />
    </th>
  );
};
