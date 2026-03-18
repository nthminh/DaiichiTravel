import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Toast } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const TYPE_STYLES = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const TYPE_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TYPE_ICON_COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

/**
 * Renders a stack of toast notifications at the bottom-right of the screen.
 * Pair with the `useToast` hook.
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = TYPE_ICONS[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95, transition: { duration: 0.2 } }}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg max-w-sm pointer-events-auto',
                TYPE_STYLES[t.type],
              )}
            >
              <Icon size={16} className={cn('shrink-0 mt-0.5', TYPE_ICON_COLORS[t.type])} />
              <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
              <button
                onClick={() => onDismiss(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
