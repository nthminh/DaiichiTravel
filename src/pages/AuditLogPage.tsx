import React, { useState, useMemo } from 'react';
import { Activity, Search, X, Filter, Clock, User, Tag, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDateTimeVN } from '../lib/vnDate';
import { TRANSLATIONS, Language } from '../App';
import { AuditLog, User as AppUser, UserRole } from '../types';
import { matchesSearch } from '../lib/searchUtils';

interface AuditLogPageProps {
  language: Language;
  logs: AuditLog[];
  currentUser?: AppUser | null;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  BOOK_TICKET: 'bg-green-100 text-green-700',
  CANCEL_BOOKING: 'bg-red-100 text-red-700',
  EDIT_TRIP: 'bg-yellow-100 text-yellow-700',
  ADD_TRIP: 'bg-purple-100 text-purple-700',
  DELETE_TRIP: 'bg-red-100 text-red-700',
  APPROVE_CATEGORY: 'bg-green-100 text-green-700',
  REJECT_CATEGORY: 'bg-red-100 text-red-700',
  EDIT_CUSTOMER: 'bg-yellow-100 text-yellow-700',
};

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ language, logs, currentUser }) => {
  const t = TRANSLATIONS[language];

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const uniqueRoles = useMemo(() => Array.from(new Set(logs.map(l => l.actorRole).filter(Boolean))).sort(), [logs]);
  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action).filter(Boolean))).sort(), [logs]);

  const filtered = useMemo(() => {
    let list = logs;
    if (roleFilter) list = list.filter(l => l.actorRole === roleFilter);
    if (actionFilter) list = list.filter(l => l.action === actionFilter);
    if (search.trim()) {
      list = list.filter(l =>
        matchesSearch(l.actorName, search) ||
        matchesSearch(l.action, search) ||
        matchesSearch(l.targetLabel || '', search) ||
        matchesSearch(l.detail || '', search) ||
        matchesSearch(l.actorRole, search)
      );
    }
    return list;
  }, [logs, search, roleFilter, actionFilter]);

  const actionLabel = (action: string) => {
    const key = `audit_action_${action.toLowerCase()}` as keyof typeof t;
    return (t[key] as string | undefined) || action;
  };

  const actionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action] || 'bg-gray-100 text-gray-600';
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', colorClass)}>
        {actionLabel(action)}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-800 flex items-center gap-2">
          <Activity size={22} className="text-daiichi-red" />
          {t.audit_log || 'Nhật ký hoạt động'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{t.audit_log_desc}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={language === 'vi' ? 'Tìm kiếm...' : 'Search...'}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
        {/* Role filter */}
        {uniqueRoles.length > 0 && (
          <select
            value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
          >
            <option value="">{t.audit_role || 'Vai trò'} – {language === 'vi' ? 'Tất cả' : 'All'}</option>
            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {/* Action filter */}
        {uniqueActions.length > 0 && (
          <select
            value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
          >
            <option value="">{t.audit_action || 'Hành động'} – {language === 'vi' ? 'Tất cả' : 'All'}</option>
            {uniqueActions.map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
        )}
        {(roleFilter || actionFilter) && (
          <button onClick={() => { setRoleFilter(''); setActionFilter(''); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-all">
            <X size={12} /> {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
          </button>
        )}
        <span className="text-xs text-gray-400 font-medium ml-auto">
          {filtered.length} {language === 'vi' ? 'kết quả' : 'results'}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">{t.audit_no_logs}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t.audit_time || 'Thời gian'}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t.audit_actor || 'Người thực hiện'}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t.audit_action || 'Hành động'}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t.audit_target || 'Đối tượng'}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t.audit_detail || 'Chi tiết'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateTimeVN(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 text-xs">{log.actorName}</div>
                      <div className="text-[10px] text-gray-400 uppercase">{log.actorRole}</div>
                    </td>
                    <td className="px-4 py-3">{actionBadge(log.action)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {log.targetLabel && <div>{log.targetLabel}</div>}
                      {log.targetType && <div className="text-[10px] text-gray-400 uppercase">{log.targetType}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={log.detail}>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-50">
            {filtered.map(log => (
              <div key={log.id} className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-gray-800 text-sm">{log.actorName}</span>
                    <span className="ml-2 text-[10px] text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded-md">{log.actorRole}</span>
                  </div>
                  {actionBadge(log.action)}
                </div>
                {(log.targetLabel || log.detail) && (
                  <p className="text-xs text-gray-500">{log.targetLabel}{log.detail ? ` — ${log.detail}` : ''}</p>
                )}
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock size={10} /> {formatDateTimeVN(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
