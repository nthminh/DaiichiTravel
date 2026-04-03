import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Clock, Eye, Filter, Search, X,
  ChevronDown, ChevronUp, User, Phone, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../App';
import { CategoryVerificationRequest, User as AppUser, UserRole, CustomerCategory } from '../types';
import { transportService } from '../services/transportService';

interface CustomerVerificationPageProps {
  language: Language;
  requests: CategoryVerificationRequest[];
  categories: CustomerCategory[];
  currentUser?: AppUser | null;
  dataRequested?: boolean;
  onLoadData?: () => void;
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export const CustomerVerificationPage: React.FC<CustomerVerificationPageProps> = ({
  language,
  requests,
  categories,
  currentUser,
  dataRequested,
  onLoadData,
}) => {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  const canReview = isAdmin || currentUser?.role === 'STAFF' || currentUser?.role === 'SUPERVISOR';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); };

  const categoryById = useMemo(() => {
    const m: Record<string, CustomerCategory> = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    let list = requests;
    if (statusFilter !== 'ALL') list = list.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, statusFilter, search]);

  const handleApprove = async (req: CategoryVerificationRequest) => {
    if (!canReview) return;
    setSaving(req.id);
    try {
      const now = new Date().toISOString();
      await transportService.updateCategoryRequest(req.id, {
        status: 'APPROVED',
        reviewedAt: now,
        reviewedBy: currentUser?.name || currentUser?.id || 'staff',
        reviewNote: reviewNote[req.id] || '',
      });
      // Update the customer profile
      await transportService.updateCustomer(req.customerId, {
        categoryId: req.categoryId,
        categoryName: req.categoryName,
        categoryVerificationStatus: 'APPROVED',
      });
      // Audit log
      await transportService.logAudit({
        actorId: currentUser?.id || '',
        actorName: currentUser?.name || '',
        actorRole: currentUser?.role || '',
        action: 'APPROVE_CATEGORY',
        targetType: 'customer',
        targetId: req.customerId,
        targetLabel: req.customerName,
        detail: `Xác nhận loại khách: ${req.categoryName}`,
        createdAt: now,
      });
      showSuccess(t.verification_approve + ' ✓');
    } catch {
      showError(language === 'vi' ? 'Không thể xác nhận. Thử lại.' : 'Could not approve. Try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleReject = async (req: CategoryVerificationRequest) => {
    if (!canReview) return;
    setSaving(req.id + '_reject');
    try {
      const now = new Date().toISOString();
      await transportService.updateCategoryRequest(req.id, {
        status: 'REJECTED',
        reviewedAt: now,
        reviewedBy: currentUser?.name || currentUser?.id || 'staff',
        reviewNote: reviewNote[req.id] || '',
      });
      // Update the customer's verification status
      await transportService.updateCustomer(req.customerId, {
        categoryVerificationStatus: 'REJECTED',
      });
      // Audit log
      await transportService.logAudit({
        actorId: currentUser?.id || '',
        actorName: currentUser?.name || '',
        actorRole: currentUser?.role || '',
        action: 'REJECT_CATEGORY',
        targetType: 'customer',
        targetId: req.customerId,
        targetLabel: req.customerName,
        detail: `Từ chối loại khách: ${req.categoryName}. Lý do: ${reviewNote[req.id] || 'không có'}`,
        createdAt: now,
      });
      showSuccess(t.verification_reject + ' ✓');
    } catch {
      showError(language === 'vi' ? 'Không thể từ chối. Thử lại.' : 'Could not reject. Try again.');
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : 'en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  const statusCounts = useMemo(() => ({
    ALL: requests.length,
    PENDING: requests.filter(r => r.status === 'PENDING').length,
    APPROVED: requests.filter(r => r.status === 'APPROVED').length,
    REJECTED: requests.filter(r => r.status === 'REJECTED').length,
  }), [requests]);

  const statusBadge = (status: CategoryVerificationRequest['status']) => {
    if (status === 'PENDING') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
        <Clock size={11} /> {t.verification_pending}
      </span>
    );
    if (status === 'APPROVED') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
        <CheckCircle2 size={11} /> {t.verification_approved}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
        <XCircle size={11} /> {t.verification_rejected}
      </span>
    );
  };

  const filterLabels: { key: StatusFilter; label: string }[] = [
    { key: 'PENDING', label: t.verification_pending },
    { key: 'ALL', label: t.verification_all },
    { key: 'APPROVED', label: t.verification_approved },
    { key: 'REJECTED', label: t.verification_rejected },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-800 flex items-center gap-2">
          <Tag size={22} className="text-daiichi-red" />
          {t.customer_verification || 'Xác nhận Loại khách'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{t.customer_verification_desc}</p>
      </div>

      {/* Lazy-load prompt */}
      {!dataRequested && (
        <div className="flex flex-col items-center justify-center py-14 gap-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Filter size={36} className="text-gray-300" />
          <p className="text-sm text-gray-500">{language === 'vi' ? 'Yêu cầu xác nhận chưa được tải. Nhấn nút bên dưới để tải dữ liệu.' : 'Verification requests not loaded yet. Click below to load.'}</p>
          <button
            onClick={onLoadData}
            className="px-5 py-2 bg-daiichi-red text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            {language === 'vi' ? 'Tải dữ liệu' : 'Load Data'}
          </button>
        </div>
      )}

      {/* Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl text-sm font-medium">
            {successMsg}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-medium">
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {filterLabels.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              statusFilter === f.key
                ? 'bg-daiichi-red text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}>
            {f.label} ({statusCounts[f.key]})
          </button>
        ))}
        <div className="flex-1 relative min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={language === 'vi' ? 'Tìm kiếm...' : 'Search...'}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">{t.verification_no_requests}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const cat = categoryById[req.categoryId];
            const isExpanded = expandedId === req.id;
            return (
              <div key={req.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Summary row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-daiichi-red/10 text-daiichi-red font-extrabold text-sm flex items-center justify-center border border-daiichi-red/20 flex-shrink-0">
                    {req.customerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 text-sm truncate">{req.customerName}</span>
                      {statusBadge(req.status)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><Phone size={10} />{req.customerPhone}</span>
                      <span className="flex items-center gap-1">
                        <Tag size={10} />
                        <span style={{ color: cat?.color || '#6B7280' }}>{req.categoryName}</span>
                      </span>
                      <span>{formatDate(req.submittedAt)}</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        {/* Proof image */}
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            {t.verification_proof_image}
                          </p>
                          <div className="flex gap-2">
                            <img
                              src={req.proofImageUrl}
                              alt="proof"
                              className="h-32 rounded-xl object-cover border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxUrl(req.proofImageUrl)}
                            />
                            <button
                              onClick={() => setLightboxUrl(req.proofImageUrl)}
                              className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
                            >
                              <Eye size={13} />
                              {t.verification_view_image}
                            </button>
                          </div>
                        </div>

                        {/* Review info if already reviewed */}
                        {req.status !== 'PENDING' && (
                          <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 text-gray-600">
                            {req.reviewedAt && <p><span className="font-bold">{t.verification_reviewed_at}:</span> {formatDate(req.reviewedAt)}</p>}
                            {req.reviewedBy && <p><span className="font-bold">{t.verification_reviewed_by}:</span> {req.reviewedBy}</p>}
                            {req.reviewNote && <p><span className="font-bold">{language === 'vi' ? 'Ghi chú:' : 'Note:'}</span> {req.reviewNote}</p>}
                          </div>
                        )}

                        {/* Action buttons for pending requests */}
                        {req.status === 'PENDING' && canReview && (
                          <div className="space-y-2">
                            <textarea
                              value={reviewNote[req.id] || ''}
                              onChange={e => setReviewNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder={t.verification_note_placeholder}
                              className="w-full border border-gray-200 rounded-xl text-sm px-3 py-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-daiichi-red/30"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(req)}
                                disabled={saving === req.id}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 disabled:opacity-60 transition-all"
                              >
                                {saving === req.id ? <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" /> : <CheckCircle2 size={15} />}
                                {t.verification_approve}
                              </button>
                              <button
                                onClick={() => handleReject(req)}
                                disabled={!!saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-60 transition-all"
                              >
                                {saving === req.id + '_reject' ? <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" /> : <XCircle size={15} />}
                                {t.verification_reject}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              className="relative max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-lg z-10 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
              <img src={lightboxUrl} alt="proof" className="w-full rounded-2xl shadow-2xl" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
