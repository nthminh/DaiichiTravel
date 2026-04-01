import React, { useState, useMemo } from 'react';
import { Activity, Search, X, Clock, ChevronDown, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDateTimeVN } from '../lib/vnDate';
import { TRANSLATIONS, Language } from '../App';
import { AuditLog, User as AppUser } from '../types';
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
  ADD_ROUTE: 'bg-indigo-100 text-indigo-700',
  EDIT_ROUTE: 'bg-yellow-100 text-yellow-700',
  DELETE_ROUTE: 'bg-red-100 text-red-700',
  ADD_EMPLOYEE: 'bg-teal-100 text-teal-700',
  EDIT_EMPLOYEE: 'bg-yellow-100 text-yellow-700',
  DELETE_EMPLOYEE: 'bg-red-100 text-red-700',
  APPROVE_CATEGORY: 'bg-green-100 text-green-700',
  REJECT_CATEGORY: 'bg-red-100 text-red-700',
  EDIT_CUSTOMER: 'bg-yellow-100 text-yellow-700',
};

interface Session {
  sessionKey: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  loginTime: string;
  logoutTime: string | null;
  activities: AuditLog[];
}

/**
 * Groups audit log entries into sessions based on LOGIN/LOGOUT pairs.
 * Each session represents a login-to-logout period for a given user.
 * Activities occurring between LOGIN and LOGOUT are associated with that session.
 */
function buildSessions(logs: AuditLog[]): Session[] {
  const chronological = [...logs].reverse();
  const sessions: Session[] = [];
  // Maps actorId → the most recently opened session for that actor
  const openSessions: Record<string, Session> = {};

  for (const log of chronological) {
    if (log.action === 'LOGIN') {
      // Use log.id as the unique session key to avoid collisions
      const key = log.id;
      const session: Session = {
        sessionKey: key,
        actorId: log.actorId,
        actorName: log.actorName,
        actorRole: log.actorRole,
        loginTime: log.createdAt,
        logoutTime: null,
        activities: [],
      };
      openSessions[log.actorId] = session;
      sessions.push(session);
    } else if (log.action === 'LOGOUT') {
      const openSession = openSessions[log.actorId];
      if (openSession) {
        openSession.logoutTime = log.createdAt;
        delete openSessions[log.actorId];
      }
    } else {
      const openSession = openSessions[log.actorId];
      if (openSession) {
        openSession.activities.push(log);
      }
    }
  }

  return sessions.reverse();
}

const ACTION_LABEL_VI: Record<string, string> = {
  BOOK_TICKET: 'Đặt vé',
  CANCEL_BOOKING: 'Hủy đặt',
  EDIT_TRIP: 'Sửa chuyến',
  ADD_TRIP: 'Thêm chuyến',
  DELETE_TRIP: 'Xóa chuyến',
  ADD_ROUTE: 'Thêm tuyến',
  EDIT_ROUTE: 'Sửa tuyến',
  DELETE_ROUTE: 'Xóa tuyến',
  ADD_EMPLOYEE: 'Thêm NV',
  EDIT_EMPLOYEE: 'Sửa NV',
  DELETE_EMPLOYEE: 'Xóa NV',
  APPROVE_CATEGORY: 'Duyệt loại KH',
  REJECT_CATEGORY: 'Từ chối loại KH',
  EDIT_CUSTOMER: 'Sửa KH',
};

function summarizeActivities(activities: AuditLog[], language: Language): string {
  if (activities.length === 0) return language === 'vi' ? 'Không có hoạt động' : 'No activities';
  const counts: Record<string, number> = {};
  for (const a of activities) counts[a.action] = (counts[a.action] || 0) + 1;
  return Object.entries(counts)
    .map(([action, count]) => `${language === 'vi' ? (ACTION_LABEL_VI[action] || action) : action}: ${count}`)
    .join(', ');
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ language, logs, currentUser }) => {
  const t = TRANSLATIONS[language];

  const [activeTab, setActiveTab] = useState<'detail' | 'session'>('detail');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

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

  const sessions = useMemo(() => {
    let s = buildSessions(logs);
    if (search.trim()) {
      s = s.filter(sess =>
        matchesSearch(sess.actorName, search) ||
        matchesSearch(sess.actorRole, search) ||
        sess.activities.some(a =>
          matchesSearch(a.targetLabel || '', search) ||
          matchesSearch(a.detail || '', search) ||
          matchesSearch(a.action, search)
        )
      );
    }
    if (roleFilter) s = s.filter(sess => sess.actorRole === roleFilter);
    return s;
  }, [logs, search, roleFilter]);

  const actionLabel = (action: string) => {
    if (language === 'vi') return ACTION_LABEL_VI[action] || action;
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

  const toggleSession = (key: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('detail')}
          className={cn(
            'px-4 py-2 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'detail'
              ? 'border-daiichi-red text-daiichi-red'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          {language === 'vi' ? 'Chi tiết' : 'Detail'}
        </button>
        <button
          onClick={() => setActiveTab('session')}
          className={cn(
            'px-4 py-2 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'session'
              ? 'border-daiichi-red text-daiichi-red'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          {language === 'vi' ? 'Theo phiên đăng nhập' : 'By Session'}
        </button>
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
        {/* Action filter – only in detail tab */}
        {activeTab === 'detail' && uniqueActions.length > 0 && (
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
          {activeTab === 'detail'
            ? `${filtered.length} ${language === 'vi' ? 'kết quả' : 'results'}`
            : `${sessions.length} ${language === 'vi' ? 'phiên' : 'sessions'}`}
        </span>
      </div>

      {/* Detail tab */}
      {activeTab === 'detail' && (
        filtered.length === 0 ? (
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
        )
      )}

      {/* Session tab */}
      {activeTab === 'session' && (
        sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">{t.audit_no_logs}</div>
        ) : (
          <div className="space-y-3">
            {sessions.map(sess => {
              const isExpanded = expandedSessions.has(sess.sessionKey);
              return (
                <div key={sess.sessionKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Session header */}
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
                    onClick={() => toggleSession(sess.sessionKey)}
                  >
                    <div className="flex-shrink-0">
                      {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">{sess.actorName}</span>
                        <span className="text-[10px] text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded-md">{sess.actorRole}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
                          sess.logoutTime ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                        )}>
                          {sess.logoutTime
                            ? (language === 'vi' ? 'Đã đăng xuất' : 'Logged out')
                            : (language === 'vi' ? 'Đang hoạt động' : 'Active')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <LogIn size={10} className="text-blue-500" />
                          {formatDateTimeVN(sess.loginTime)}
                        </span>
                        {sess.logoutTime && (
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <LogOut size={10} className="text-gray-400" />
                            {formatDateTimeVN(sess.logoutTime)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {sess.activities.length === 0
                          ? (language === 'vi' ? 'Không có hoạt động nào trong phiên này' : 'No activities in this session')
                          : (language === 'vi'
                              ? `${sess.activities.length} hoạt động: ${summarizeActivities(sess.activities, language)}`
                              : `${sess.activities.length} activities: ${summarizeActivities(sess.activities, language)}`
                            )
                        }
                      </p>
                    </div>
                  </button>

                  {/* Session activities (expandable) */}
                  <AnimatePresence>
                    {isExpanded && sess.activities.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {sess.activities.map(log => (
                            <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                              <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5 w-28 flex-shrink-0">
                                {formatDateTimeVN(log.createdAt)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {actionBadge(log.action)}
                                  {log.targetLabel && (
                                    <span className="text-xs text-gray-700 font-medium">{log.targetLabel}</span>
                                  )}
                                </div>
                                {log.detail && (
                                  <p className="text-xs text-gray-500 mt-0.5">{log.detail}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
