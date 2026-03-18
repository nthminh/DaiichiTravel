import React, { useState } from 'react';
import { CheckCircle2, XCircle, MapPin, Bus, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS } from '../constants/translations';
import type { Language } from '../constants/translations';
import { DriverAssignment } from '../types';
import { transportService } from '../services/transportService';

interface DriverTaskPanelProps {
  language: Language;
  driverEmployeeId: string;
  driverName: string;
  assignments: DriverAssignment[];
}

export const DriverTaskPanel: React.FC<DriverTaskPanelProps> = ({
  language,
  driverEmployeeId,
  driverName,
  assignments,
}) => {
  const t = TRANSLATIONS[language];
  const [expanded, setExpanded] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Filter tasks for this driver
  const myTasks = assignments.filter(
    a => a.driverEmployeeId === driverEmployeeId || a.driverName === driverName
  );

  const pendingTasks = myTasks.filter(a => a.status === 'pending');
  const respondedTasks = myTasks.filter(a => a.status !== 'pending');

  const handleAccept = async (assignment: DriverAssignment) => {
    setLoading(assignment.id);
    try {
      await transportService.updateDriverAssignment(assignment.id, {
        status: 'accepted',
        respondedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to accept task:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (assignment: DriverAssignment) => {
    setLoading(assignment.id);
    try {
      await transportService.updateDriverAssignment(assignment.id, {
        status: 'rejected',
        respondedAt: new Date().toISOString(),
        rejectionReason: rejectionReason[assignment.id] || '',
      });
      setShowRejectInput(null);
      setRejectionReason(p => { const n = { ...p }; delete n[assignment.id]; return n; });
    } catch (err) {
      console.error('Failed to reject task:', err);
    } finally {
      setLoading(null);
    }
  };

  const StatusIcon = ({ status }: { status: DriverAssignment['status'] }) => {
    if (status === 'accepted') return <CheckCircle2 size={14} className="text-green-600" />;
    if (status === 'rejected') return <XCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-amber-500 animate-pulse" />;
  };

  const renderTask = (a: DriverAssignment) => (
    <div
      key={a.id}
      className={cn(
        'border rounded-2xl p-4 space-y-3 transition-all',
        a.status === 'pending' ? 'border-amber-200 bg-amber-50/50' :
        a.status === 'accepted' ? 'border-green-200 bg-green-50/50' :
        'border-red-100 bg-red-50/30'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <StatusIcon status={a.status} />
            <span className={cn('text-[10px] font-bold uppercase tracking-widest',
              a.status === 'pending' ? 'text-amber-600' :
              a.status === 'accepted' ? 'text-green-700' : 'text-red-600'
            )}>
              {a.status === 'accepted' ? (t.assignment_accepted || 'Đã nhận') :
               a.status === 'rejected' ? (t.assignment_rejected || 'Từ chối') :
               (t.assignment_pending || 'Chờ xác nhận')}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-800 mt-1">{a.tripRoute || '—'}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <Bus size={11} />
            <span>{a.licensePlate || '—'}</span>
            <span>•</span>
            <span>{a.tripDate} {a.tripTime}</span>
          </div>
        </div>
      </div>

      {/* Passenger info */}
      <div className="text-sm space-y-1">
        <div className="flex gap-2">
          <span className="text-gray-400 w-16 shrink-0">{language === 'vi' ? 'Khách:' : 'Guest:'}</span>
          <span className="font-medium">{a.customerName} {a.customerPhone ? `• ${a.customerPhone}` : ''}</span>
        </div>
        {a.pickupAddress && (
          <div className="flex gap-2">
            <span className="text-gray-400 w-16 shrink-0">{language === 'vi' ? 'Đón:' : 'Pickup:'}</span>
            <span className="text-green-700">{a.pickupAddress}</span>
          </div>
        )}
        {a.dropoffAddress && (
          <div className="flex gap-2">
            <span className="text-gray-400 w-16 shrink-0">{language === 'vi' ? 'Trả:' : 'Dropoff:'}</span>
            <span className="text-red-600">{a.dropoffAddress}</span>
          </div>
        )}
        {a.note && (
          <div className="flex gap-2">
            <span className="text-gray-400 w-16 shrink-0">{language === 'vi' ? 'Ghi chú:' : 'Note:'}</span>
            <span className="text-gray-600 italic">{a.note}</span>
          </div>
        )}
      </div>

      {/* Actions for pending tasks */}
      {a.status === 'pending' && (
        <div className="space-y-2 pt-1 border-t border-amber-100">
          {showRejectInput === a.id ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder={t.driver_task_rejection_reason || 'Lý do từ chối (không bắt buộc)'}
                value={rejectionReason[a.id] || ''}
                onChange={e => setRejectionReason(p => ({ ...p, [a.id]: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleReject(a)}
                  disabled={loading === a.id}
                  className="flex-1 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {loading === a.id ? '...' : (t.driver_task_reject || 'Từ chối')}
                </button>
                <button
                  onClick={() => setShowRejectInput(null)}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleAccept(a)}
                disabled={loading === a.id}
                className="flex-1 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                {loading === a.id ? '...' : (t.driver_task_accept || 'Nhận việc')}
              </button>
              <button
                onClick={() => setShowRejectInput(a.id)}
                className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle size={13} />
                {t.driver_task_reject || 'Từ chối'}
              </button>
            </div>
          )}
        </div>
      )}
      {a.status === 'rejected' && a.rejectionReason && (
        <p className="text-[10px] text-red-500 italic">{language === 'vi' ? 'Lý do: ' : 'Reason: '}{a.rejectionReason}</p>
      )}
    </div>
  );

  if (myTasks.length === 0) return null;

  return (
    <div className="fixed bottom-8 left-8 z-40 w-[340px] bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white"
      >
        <div className="flex items-center gap-2.5">
          <MapPin size={16} />
          <span className="font-bold text-sm">{t.driver_tasks_title || 'Nhiệm vụ của tôi'}</span>
          {pendingTasks.length > 0 && (
            <span className="bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingTasks.length} {language === 'vi' ? 'mới' : 'new'}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[50vh] overflow-y-auto px-4 py-3 space-y-3">
              {myTasks.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">
                  {t.no_driver_tasks || 'Bạn chưa có nhiệm vụ nào.'}
                </p>
              ) : (
                <>
                  {pendingTasks.map(renderTask)}
                  {respondedTasks.length > 0 && pendingTasks.length > 0 && (
                    <div className="h-px bg-gray-100 my-1" />
                  )}
                  {respondedTasks.map(renderTask)}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
