import { useState } from 'react';
import { Search, X, Filter, Users, Wallet, Star, Edit3, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../constants/translations';
import { Agent, Employee, Route, User, UserRole } from '../types';
import { ResizableTh } from '../components/ResizableTh';
import { NotePopover } from '../components/NotePopover';
import { ConflictWarningBanner } from '../components/ConflictWarningBanner';
import { useAgents, DEFAULT_AGENT_FORM } from '../hooks/useAgents';

interface AgentsPageProps {
  agents: Agent[];
  employees: Employee[];
  language: Language;
  routes: Route[];
  currentUser?: User | null;
}

export function AgentsPage({ agents, employees, language, routes, currentUser }: AgentsPageProps) {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;

  const [agentSearch, setAgentSearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showAgentFilters, setShowAgentFilters] = useState(false);
  const [agentColWidths, setAgentColWidths] = useState({ name: 200, username: 150, address: 200, phone: 150, commission: 130, balance: 150, status: 120, options: 120 });
  const [showRouteCommissions, setShowRouteCommissions] = useState(false);

  const {
    showAddAgent,
    setShowAddAgent,
    editingAgent,
    setEditingAgent,
    agentForm,
    setAgentForm,
    agentFormError,
    setAgentFormError,
    agentConflictWarning,
    setAgentConflictWarning,
    handleSaveAgent,
    handleForceSaveAgent,
    handleDeleteAgent,
    handleStartEditAgent,
    handleSaveAgentNote,
  } = useAgents({ agents, employees, language });

  // Computed filtered list
  const filteredAgents = agents.filter(agent => {
    const q = agentSearch.toLowerCase();
    const matchSearch = !q ||
      String(agent.name ?? '').toLowerCase().includes(q) ||
      String(agent.code ?? '').toLowerCase().includes(q) ||
      String(agent.phone ?? '').toLowerCase().includes(q) ||
      String(agent.email ?? '').toLowerCase().includes(q) ||
      String(agent.address ?? '').toLowerCase().includes(q);
    const matchStatus = agentStatusFilter === 'ALL' || agent.status === agentStatusFilter;
    return matchSearch && matchStatus;
  });

  // Computed stats from filtered list
  const totalBalance = filteredAgents.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalCommission = filteredAgents.reduce((sum, a) => sum + ((a.balance || 0) * (a.commissionRate || 0) / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold">{t.agents}</h2><p className="text-sm text-gray-500">{t.agent_desc}</p></div>
        <button onClick={() => { setShowAddAgent(true); setEditingAgent(null); setAgentForm({ ...DEFAULT_AGENT_FORM }); setAgentFormError(''); setShowRouteCommissions(false); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_agent}</button>
      </div>

      {/* Add/Edit Agent Modal */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingAgent ? (language === 'vi' ? 'Chỉnh sửa đại lý' : 'Edit Agent') : (language === 'vi' ? 'Thêm đại lý mới' : 'Add New Agent')}</h3>
              <button onClick={() => { setShowAddAgent(false); setEditingAgent(null); setAgentFormError(''); setShowRouteCommissions(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tên đại lý' : 'Agent Name'}</label><input type="text" value={agentForm.name} onChange={e => setAgentForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mã đại lý' : 'Agent Code'}</label><input type="text" value={agentForm.code} onChange={e => setAgentForm(p => ({ ...p, code: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.phone_number}</label><input type="text" value={agentForm.phone} onChange={e => setAgentForm(p => ({ ...p, phone: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label><input type="email" value={agentForm.email} onChange={e => setAgentForm(p => ({ ...p, email: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Địa chỉ' : 'Address'}</label><input type="text" value={agentForm.address} onChange={e => setAgentForm(p => ({ ...p, address: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.commission} (%)</label><input type="number" min="0" max="100" value={agentForm.commissionRate} onChange={e => setAgentForm(p => ({ ...p, commissionRate: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label><select value={agentForm.status} onChange={e => setAgentForm(p => ({ ...p, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none"><option value="ACTIVE">{t.status_active}</option><option value="INACTIVE">{t.status_locked}</option></select></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.username}</label><input type="text" value={agentForm.username} onChange={e => { setAgentForm(p => ({ ...p, username: e.target.value })); setAgentFormError(''); }} className={`w-full mt-1 px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 ${agentFormError ? 'border-red-400' : 'border-gray-100'}`} />{agentFormError && <p className="text-xs text-red-500 mt-1 ml-1">{agentFormError}</p>}</div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Mật khẩu' : 'Password'}</label><input type="text" value={agentForm.password} onChange={e => setAgentForm(p => ({ ...p, password: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              {/* Payment Type section */}
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t.agent_payment_type || 'Hình thức thanh toán'}</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setAgentForm(p => ({ ...p, paymentType: 'POSTPAID' }))} className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all', agentForm.paymentType === 'POSTPAID' ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200')}>
                    ✓ {t.agent_postpaid || 'Được thanh toán sau'}
                  </button>
                  <button type="button" onClick={() => setAgentForm(p => ({ ...p, paymentType: 'PREPAID' }))} className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all', agentForm.paymentType === 'PREPAID' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200')}>
                    ⚠ {t.agent_prepaid || 'Phải thanh toán trước'}
                  </button>
                </div>
              </div>
              {agentForm.paymentType === 'POSTPAID' && (
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_credit_limit || 'Hạn mức công nợ (đ)'}</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={agentForm.creditLimit || ''} placeholder="" onChange={e => setAgentForm(p => ({ ...p, creditLimit: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              )}
              {agentForm.paymentType === 'PREPAID' && (
                <>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">{t.agent_payment_options || 'Phương thức thanh toán cho phép'} <span className="text-gray-300 font-normal normal-case">({t.agent_payment_options_note || 'tùy chọn'})</span></p>
                    <div className="flex flex-wrap gap-2">
                      {(['DEPOSIT', 'BANK_TRANSFER', 'HOLD_WITH_CUSTOMER_TIME'] as const).map(opt => {
                        const label = opt === 'DEPOSIT' ? (t.agent_payment_deposit || 'Nộp tiền ký quỹ') : opt === 'BANK_TRANSFER' ? (t.agent_payment_bank_transfer || 'Chuyển khoản') : (t.agent_payment_hold_customer_time || 'Giữ vé theo thời gian khách');
                        const isSelected = agentForm.allowedPaymentOptions.includes(opt);
                        return (
                          <button key={opt} type="button"
                            onClick={() => setAgentForm(p => ({ ...p, allowedPaymentOptions: isSelected ? p.allowedPaymentOptions.filter(x => x !== opt) : [...p.allowedPaymentOptions, opt] }))}
                            className={cn('px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all', isSelected ? 'border-daiichi-red bg-daiichi-accent text-daiichi-red' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200')}
                          >
                            {isSelected ? '✓ ' : ''}{label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {agentForm.allowedPaymentOptions.includes('DEPOSIT') && (
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_deposit || 'Tiền ký quỹ (đ)'}</label><input type="number" min="0" value={agentForm.depositAmount} onChange={e => setAgentForm(p => ({ ...p, depositAmount: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                  )}
                  {agentForm.allowedPaymentOptions.includes('HOLD_WITH_CUSTOMER_TIME') && (
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_hold_ticket_hours || 'Thời gian giữ vé (giờ)'}</label><input type="number" min="1" max="72" value={agentForm.holdTicketHours} onChange={e => setAgentForm(p => ({ ...p, holdTicketHours: parseInt(e.target.value) || 24 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                  )}
                </>
              )}
            </div>

            {/* Per-route commission rates */}
            {routes.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRouteCommissions(p => !p)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {language === 'vi' ? 'Chiết khấu theo tuyến' : 'Per-route Commission'}
                  </span>
                  {Object.keys(agentForm.routeCommissionRates).length > 0 && (
                    <span className="px-2 py-0.5 bg-daiichi-accent text-daiichi-red rounded-full text-[10px] font-bold">
                      {Object.keys(agentForm.routeCommissionRates).length}
                    </span>
                  )}
                  {showRouteCommissions ? <ChevronUp size={14} className="text-gray-400 ml-auto" /> : <ChevronDown size={14} className="text-gray-400 ml-auto" />}
                </button>
                {showRouteCommissions && (
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                    <p className="text-xs text-gray-400 mb-2">
                      {language === 'vi'
                        ? `Để trống = dùng chiết khấu mặc định (${agentForm.commissionRate}%)`
                        : `Leave empty = use default commission (${agentForm.commissionRate}%)`}
                    </p>
                    {routes.map(route => {
                      const val = agentForm.routeCommissionRates[route.id];
                      return (
                        <div key={route.id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-700 truncate" title={route.name}>{route.name}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder={String(agentForm.commissionRate)}
                              value={val !== undefined ? val : ''}
                              onChange={e => {
                                const raw = e.target.value;
                                setAgentForm(p => {
                                  const updated = { ...p.routeCommissionRates };
                                  if (raw === '' || raw === undefined) {
                                    delete updated[route.id];
                                  } else {
                                    const num = parseFloat(raw);
                                    if (!isNaN(num)) updated[route.id] = num;
                                  }
                                  return { ...p, routeCommissionRates: updated };
                                });
                              }}
                              className="w-20 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                            />
                            <span className="text-xs text-gray-400">%</span>
                            {val !== undefined && (
                              <button
                                type="button"
                                onClick={() => setAgentForm(p => {
                                  const updated = { ...p.routeCommissionRates };
                                  delete updated[route.id];
                                  return { ...p, routeCommissionRates: updated };
                                })}
                                className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                                title={language === 'vi' ? 'Xóa' : 'Clear'}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-2">
              <button onClick={() => { setShowAddAgent(false); setEditingAgent(null); setAgentFormError(''); setShowRouteCommissions(false); setAgentConflictWarning(false); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
              <button onClick={() => handleSaveAgent()} disabled={!agentForm.name || !agentForm.code} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingAgent ? t.save : t.add_agent}</button>
            </div>
            {agentConflictWarning && (
              <ConflictWarningBanner
                language={language}
                onCancel={() => { setAgentConflictWarning(false); setShowAddAgent(false); setEditingAgent(null); setAgentFormError(''); setShowRouteCommissions(false); }}
                onForceOverwrite={handleForceSaveAgent}
              />
            )}
          </div>
        </div>
      )}

      {/* Search & Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm theo tên, mã, SĐT, email...' : 'Search by name, code, phone, email...'}
              value={agentSearch}
              onChange={e => setAgentSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
            />
          </div>
          <button
            onClick={() => setShowAgentFilters(p => !p)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
              showAgentFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Filter size={15} />
            {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
            {agentStatusFilter !== 'ALL' && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">1</span>
            )}
          </button>
          {(agentSearch || agentStatusFilter !== 'ALL') && (
            <button
              onClick={() => { setAgentSearch(''); setAgentStatusFilter('ALL'); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
            >
              <X size={14} />
              {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
            </button>
          )}
        </div>
        {showAgentFilters && (
          <div className="flex gap-4 flex-wrap pt-1 border-t border-gray-100">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                {t.status}
              </label>
              <div className="flex gap-2">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setAgentStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                      agentStatusFilter === s
                        ? s === 'ACTIVE' ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                          : s === 'INACTIVE' ? 'bg-red-100 text-red-600 ring-2 ring-red-400'
                          : 'bg-daiichi-red text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                  >
                    {s === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All')
                      : s === 'ACTIVE' ? t.status_active
                      : t.status_locked}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {(agentSearch || agentStatusFilter !== 'ALL') && (
          <p className="text-xs text-gray-500">
            {language === 'vi'
              ? `Hiển thị ${filteredAgents.length} / ${agents.length} đại lý`
              : `Showing ${filteredAgents.length} / ${agents.length} agents`}
          </p>
        )}
      </div>

      {/* Stats – computed from filtered results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t.total_agents, value: filteredAgents.length, icon: Users, color: 'text-blue-600', raw: true },
          { label: t.agent_revenue, value: totalBalance.toLocaleString() + 'đ', icon: Wallet, color: 'text-green-600', raw: false },
          { label: t.commission_paid, value: Math.round(totalCommission).toLocaleString() + 'đ', icon: Star, color: 'text-daiichi-red', raw: false },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                <h3 className="text-2xl font-bold mt-2">{s.value}</h3>
                {(agentSearch || agentStatusFilter !== 'ALL') && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {language === 'vi' ? 'Kết quả tìm kiếm' : 'Filtered result'}
                  </p>
                )}
              </div>
              <div className={cn("p-3 rounded-xl bg-gray-50", s.color)}><s.icon size={20} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <ResizableTh width={agentColWidths.name} onResize={(w) => setAgentColWidths(p => ({ ...p, name: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.agent_id_name}</ResizableTh>
              <ResizableTh width={agentColWidths.username} onResize={(w) => setAgentColWidths(p => ({ ...p, username: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.username}</ResizableTh>
              <ResizableTh width={agentColWidths.address} onResize={(w) => setAgentColWidths(p => ({ ...p, address: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Địa chỉ' : 'Address'}</ResizableTh>
              <ResizableTh width={agentColWidths.phone} onResize={(w) => setAgentColWidths(p => ({ ...p, phone: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.phone_number}</ResizableTh>
              <ResizableTh width={agentColWidths.commission} onResize={(w) => setAgentColWidths(p => ({ ...p, commission: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.commission}</ResizableTh>
              <ResizableTh width={agentColWidths.balance} onResize={(w) => setAgentColWidths(p => ({ ...p, balance: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.balance}</ResizableTh>
              <ResizableTh width={agentColWidths.status} onResize={(w) => setAgentColWidths(p => ({ ...p, status: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.status}</ResizableTh>
              <ResizableTh width={agentColWidths.options} onResize={(w) => setAgentColWidths(p => ({ ...p, options: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAgents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-8 py-12 text-center text-gray-400 text-sm">
                  {language === 'vi' ? 'Không tìm thấy đại lý nào phù hợp.' : 'No agents found matching your search.'}
                </td>
              </tr>
            ) : filteredAgents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-6"><p className="font-bold text-gray-800">{agent.name}</p><p className="text-xs text-gray-400 font-mono">{agent.code}</p></td>
                <td className="px-8 py-6"><p className="text-xs font-bold text-gray-700">User: <span className="text-daiichi-red">{agent.username}</span></p><p className="text-[10px] text-gray-400">Pass: {agent.password ? '••••••' : <span className="text-gray-300">—</span>}</p></td>
                <td className="px-8 py-6"><p className="text-sm text-gray-700">{agent.address ? agent.address : <span className="text-gray-300">—</span>}</p></td>
                <td className="px-8 py-6"><p className="text-sm font-medium">{agent.phone}</p><p className="text-xs text-gray-400">{agent.email}</p></td>
                <td className="px-8 py-6">
                  <span className="px-3 py-1 bg-daiichi-accent text-daiichi-red rounded-full text-xs font-bold">{agent.commissionRate}%</span>
                  <div className="mt-1.5">
                    {(agent.paymentType === 'POSTPAID' || !agent.paymentType) ? (
                      <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">{t.agent_postpaid || 'Thanh toán sau'}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold">{t.agent_prepaid || 'Trả trước'}</span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6 font-bold text-gray-700">{(agent.balance || 0).toLocaleString()}đ</td>
                <td className="px-8 py-6"><span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", agent.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>{agent.status === 'ACTIVE' ? t.status_active : t.status_locked}</span></td>
                <td className="px-8 py-6"><div className="flex gap-3 items-center"><button onClick={() => { handleStartEditAgent(agent); setShowRouteCommissions(false); }} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button>{isAdmin && <button onClick={() => handleDeleteAgent(agent.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button>}<NotePopover note={agent.note} onSave={(note) => handleSaveAgentNote(agent.id, note)} language={language} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
