import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, TrendingUp, AlertCircle, CheckCircle2, Clock,
  Download, Plus, Search, Filter, DollarSign, Users,
  ChevronDown, ChevronUp, X, Printer, Eye, Trash2, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, TRANSLATIONS } from '../App';
import { transportService } from '../services/transportService';
import { Invoice, InvoiceItem } from '../types';
import * as XLSX from 'xlsx';
import { ResizableTh } from './ResizableTh';

interface FinancialReportProps {
  language: Language;
  agents: { id: string; name: string; code: string; balance: number; address?: string }[];
}

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

const emptyInvoiceItem = (): InvoiceItem => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  total: 0,
  type: 'TICKET',
});

export const FinancialReport: React.FC<FinancialReportProps> = ({ language, agents }) => {
  const t = TRANSLATIONS[language];
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'invoices' | 'debt'>('overview');
  const [period, setPeriod] = useState<Period>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'RETAIL' | 'AGENT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Invoice | null>(null);
  const [paymentInput, setPaymentInput] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  const [colWidths, setColWidths] = useState({
    invoiceNo: 150,
    customer: 200,
    type: 130,
    total: 150,
    paid: 150,
    debt: 150,
    status: 130,
    options: 120,
  });

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: 'RETAIL',
    customerName: '',
    customerPhone: '',
    items: [emptyInvoiceItem()],
    discount: 0,
    tax: 0,
    status: 'UNPAID',
    paymentMethod: 'CASH',
  });

  useEffect(() => {
    const unsubInvoices = transportService.subscribeToInvoices(setInvoices);
    const unsubBookings = transportService.subscribeToBookings(setBookings);
    return () => { unsubInvoices(); unsubBookings(); };
  }, []);

  const getPeriodRange = useCallback((): { from: Date; to: Date } => {
    const now = new Date();
    switch (period) {
      case 'this_month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      case 'last_month':
        return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) };
      case 'this_quarter': {
        const q = Math.floor(now.getMonth() / 3);
        return { from: new Date(now.getFullYear(), q * 3, 1), to: new Date(now.getFullYear(), q * 3 + 3, 0) };
      }
      case 'this_year':
        return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
      case 'custom':
        return { from: customFrom ? new Date(customFrom) : new Date(0), to: customTo ? new Date(customTo) : new Date() };
      default:
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date() };
    }
  }, [period, customFrom, customTo]);

  const { from, to } = getPeriodRange();

  const filteredBookings = bookings.filter(b => {
    const date = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return date >= from && date <= to;
  });

  const totalBookingRevenue = filteredBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

  const filteredInvoices = invoices.filter(inv => {
    const dateOk = (() => {
      const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt || 0);
      return d >= from && d <= to;
    })();
    const typeOk = filterType === 'ALL' || inv.type === filterType;
    const statusOk = filterStatus === 'ALL' || inv.status === filterStatus;
    const searchOk = !searchQuery || inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.agentName?.toLowerCase().includes(searchQuery.toLowerCase());
    return dateOk && typeOk && statusOk && searchOk;
  });

  const totalInvoiceRevenue = filteredInvoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = filteredInvoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalDebt = filteredInvoices.reduce((s, i) => s + i.debtAmount, 0);
  const paidCount = filteredInvoices.filter(i => i.status === 'PAID').length;
  const unpaidCount = filteredInvoices.filter(i => i.status === 'UNPAID').length;
  const partialCount = filteredInvoices.filter(i => i.status === 'PARTIAL').length;

  // Debt by agent
  const agentDebtMap: Record<string, { name: string; debt: number; invoices: Invoice[] }> = {};
  invoices.filter(i => i.type === 'AGENT' && i.debtAmount > 0).forEach(inv => {
    const key = inv.agentId || inv.agentName || '';
    if (!agentDebtMap[key]) agentDebtMap[key] = { name: inv.agentName || '', debt: 0, invoices: [] };
    agentDebtMap[key].debt += inv.debtAmount;
    agentDebtMap[key].invoices.push(inv);
  });

  // Revenue by route (from bookings)
  const routeRevMap: Record<string, number> = {};
  filteredBookings.forEach(b => {
    if (b.route) routeRevMap[b.route] = (routeRevMap[b.route] || 0) + (b.amount || 0);
  });
  const topRoutes = Object.entries(routeRevMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Revenue by agent (from bookings)
  const agentRevMap: Record<string, number> = {};
  filteredBookings.forEach(b => {
    const agent = b.agent || 'Trực tiếp';
    agentRevMap[agent] = (agentRevMap[agent] || 0) + (b.amount || 0);
  });
  const topAgents = Object.entries(agentRevMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const calcInvoiceTotals = (items: InvoiceItem[], discount: number, tax: number) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discountAmt = subtotal * (discount / 100);
    const taxAmt = (subtotal - discountAmt) * (tax / 100);
    const total = subtotal - discountAmt + taxAmt;
    return { subtotal, total };
  };

  const handleCreateInvoice = async () => {
    const items = (newInvoice.items || []).map(i => ({ ...i, total: i.quantity * i.unitPrice }));
    const { subtotal, total } = calcInvoiceTotals(items, newInvoice.discount || 0, newInvoice.tax || 0);
    const invoice: Omit<Invoice, 'id'> = {
      invoiceNumber: `INV-${Date.now()}`,
      type: newInvoice.type || 'RETAIL',
      customerName: newInvoice.customerName || '',
      customerPhone: newInvoice.customerPhone,
      agentId: newInvoice.agentId,
      agentName: newInvoice.agentName,
      items,
      subtotal,
      discount: newInvoice.discount || 0,
      tax: newInvoice.tax || 0,
      total,
      paidAmount: 0,
      debtAmount: total,
      status: 'UNPAID',
      paymentMethod: newInvoice.paymentMethod,
      dueDate: newInvoice.dueDate,
      notes: newInvoice.notes,
    };
    await transportService.createInvoice(invoice);
    setShowCreateModal(false);
    setNewInvoice({ type: 'RETAIL', customerName: '', customerPhone: '', items: [emptyInvoiceItem()], discount: 0, tax: 0, status: 'UNPAID', paymentMethod: 'CASH' });
    setAgentSearch('');
    setShowAgentDropdown(false);
  };

  const handleRecordPayment = async () => {
    if (!showPaymentModal) return;
    const amount = parseFloat(paymentInput) || 0;
    const newPaid = showPaymentModal.paidAmount + amount;
    const newDebt = showPaymentModal.total - newPaid;
    const newStatus: Invoice['status'] = newDebt <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';
    await transportService.updateInvoice(showPaymentModal.id, { paidAmount: newPaid, debtAmount: newDebt, status: newStatus });
    setShowPaymentModal(null);
    setPaymentInput('');
  };

  const handleDeleteInvoice = async (id: string) => {
    if (window.confirm(language === 'vi' ? 'Xác nhận xóa hóa đơn này?' : language === 'en' ? 'Delete this invoice?' : 'この請求書を削除しますか？')) {
      await transportService.deleteInvoice(id);
    }
  };

  const handleExportReport = () => {
    const data = filteredInvoices.map(inv => ({
      [t.invoice_number || 'Invoice No.']: inv.invoiceNumber,
      [t.invoice_type || 'Type']: inv.type,
      [t.customer_name || 'Customer']: inv.customerName,
      [t.total_amount || 'Total']: inv.total,
      [t.paid_amount || 'Paid']: inv.paidAmount,
      [t.debt_amount || 'Debt']: inv.debtAmount,
      [t.invoice_status || 'Status']: inv.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const statusColor: Record<Invoice['status'], string> = {
    PAID: 'bg-green-100 text-green-700',
    UNPAID: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-yellow-100 text-yellow-700',
  };

  const statusLabel: Record<Invoice['status'], string> = {
    PAID: t.status_paid || 'Paid',
    UNPAID: t.status_unpaid || 'Unpaid',
    PARTIAL: t.status_partial || 'Partial',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t.financial_report || 'Financial Report'}</h2>
          <p className="text-sm text-gray-500">{t.financial_report_desc || 'Invoices, debts and revenue reports'}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportReport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">
            <Download size={16} />
            {t.export_report || 'Export'}
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all text-sm">
            <Plus size={16} />
            {t.create_invoice || 'Create Invoice'}
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.period || 'Period'}:</span>
        {(['this_month', 'last_month', 'this_quarter', 'this_year', 'custom'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              period === p ? "bg-daiichi-red text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            {t[p] || p}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs" />
            <span className="text-gray-400">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs" />
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex bg-white border border-gray-100 p-1 rounded-2xl w-fit">
        {(['overview', 'invoices', 'debt'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn(
              "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeSection === s ? "bg-daiichi-red text-white shadow" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            {s === 'overview' ? (t.revenue_overview || 'Overview') :
              s === 'invoices' ? (t.invoice_management || 'Invoices') :
                (t.debt_management || 'Debt')}
          </button>
        ))}
      </div>

      {/* OVERVIEW SECTION */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t.total_revenue || 'Total Revenue', value: totalBookingRevenue.toLocaleString() + 'đ', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: t.total_invoices || 'Total Invoices', value: filteredInvoices.length.toString(), icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: t.total_debt || 'Total Debt', value: totalDebt.toLocaleString() + 'đ', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
              { label: t.paid_invoices || 'Paid', value: totalPaid.toLocaleString() + 'đ', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
            ].map((card, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.label}</p>
                  <div className={cn("p-2 rounded-xl", card.bg, card.color)}>
                    <card.icon size={18} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-800">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Invoice Status Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t.paid_invoices || 'Paid', count: paidCount, color: 'bg-green-500' },
              { label: t.partial_invoices || 'Partial', count: partialCount, color: 'bg-yellow-500' },
              { label: t.unpaid_invoices || 'Unpaid', count: unpaidCount, color: 'bg-red-500' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className={cn("w-3 h-12 rounded-full", s.color)} />
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{s.count}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top Routes & Agents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold mb-4">{t.top_routes || 'Top Routes'}</h3>
              <div className="space-y-3">
                {topRoutes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dữ liệu' : language === 'en' ? 'No data' : 'データなし'}</p>
                ) : topRoutes.map(([route, rev], i) => (
                  <div key={route} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-daiichi-accent rounded-lg flex items-center justify-center text-[10px] font-bold text-daiichi-red">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-700">{route}</span>
                    </div>
                    <span className="text-sm font-bold text-daiichi-red">{rev.toLocaleString()}đ</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold mb-4">{t.top_agents || 'Top Agents'}</h3>
              <div className="space-y-3">
                {topAgents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">{language === 'vi' ? 'Chưa có dữ liệu' : language === 'en' ? 'No data' : 'データなし'}</p>
                ) : topAgents.map(([agent, rev], i) => (
                  <div key={agent} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-daiichi-accent rounded-lg flex items-center justify-center text-[10px] font-bold text-daiichi-red">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-700">{agent}</span>
                    </div>
                    <span className="text-sm font-bold text-daiichi-red">{rev.toLocaleString()}đ</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVOICES SECTION */}
      {activeSection === 'invoices' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.search_customer || 'Search...'}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none">
              <option value="ALL">{language === 'vi' ? 'Tất cả loại' : language === 'en' ? 'All types' : '全タイプ'}</option>
              <option value="RETAIL">{t.invoice_retail || 'Retail'}</option>
              <option value="AGENT">{t.invoice_agent || 'Agent'}</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none">
              <option value="ALL">{t.filter_status_all || 'All statuses'}</option>
              <option value="UNPAID">{t.status_unpaid || 'Unpaid'}</option>
              <option value="PARTIAL">{t.status_partial || 'Partial'}</option>
              <option value="PAID">{t.status_paid || 'Paid'}</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <ResizableTh width={colWidths.invoiceNo} onResize={(w) => setColWidths(p => ({ ...p, invoiceNo: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.invoice_number || 'Invoice No.'}</ResizableTh>
                    <ResizableTh width={colWidths.customer} onResize={(w) => setColWidths(p => ({ ...p, customer: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.customer_name || 'Customer'}</ResizableTh>
                    <ResizableTh width={colWidths.type} onResize={(w) => setColWidths(p => ({ ...p, type: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.invoice_type || 'Type'}</ResizableTh>
                    <ResizableTh width={colWidths.total} onResize={(w) => setColWidths(p => ({ ...p, total: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.total_amount || 'Total'}</ResizableTh>
                    <ResizableTh width={colWidths.paid} onResize={(w) => setColWidths(p => ({ ...p, paid: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.paid_amount || 'Paid'}</ResizableTh>
                    <ResizableTh width={colWidths.debt} onResize={(w) => setColWidths(p => ({ ...p, debt: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.debt_amount || 'Debt'}</ResizableTh>
                    <ResizableTh width={colWidths.status} onResize={(w) => setColWidths(p => ({ ...p, status: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.invoice_status || 'Status'}</ResizableTh>
                    <ResizableTh width={colWidths.options} onResize={(w) => setColWidths(p => ({ ...p, options: w }))} className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options || 'Options'}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm">
                        {language === 'vi' ? 'Chưa có hóa đơn nào' : language === 'en' ? 'No invoices found' : '請求書はありません'}
                      </td>
                    </tr>
                  ) : filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-daiichi-red text-sm">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800 text-sm">{inv.customerName}</p>
                        {inv.agentName && <p className="text-xs text-gray-400">{inv.agentName}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase", inv.type === 'RETAIL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
                          {inv.type === 'RETAIL' ? (t.invoice_retail || 'Retail') : (t.invoice_agent || 'Agent')}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-800">{inv.total.toLocaleString()}đ</td>
                      <td className="px-6 py-4 font-bold text-green-600">{inv.paidAmount.toLocaleString()}đ</td>
                      <td className="px-6 py-4 font-bold text-red-600">{inv.debtAmount.toLocaleString()}đ</td>
                      <td className="px-6 py-4">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", statusColor[inv.status])}>
                          {statusLabel[inv.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => setShowInvoiceDetail(inv)} className="text-gray-600 hover:text-daiichi-red" title={t.view_invoice || 'View'}><Eye size={16} /></button>
                          {inv.status !== 'PAID' && (
                            <button onClick={() => { setShowPaymentModal(inv); setPaymentInput(''); }} className="text-gray-600 hover:text-green-600" title={t.record_payment || 'Record Payment'}><DollarSign size={16} /></button>
                          )}
                          <button onClick={() => handleDeleteInvoice(inv.id)} className="text-gray-600 hover:text-red-600" title={t.delete || 'Delete'}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DEBT SECTION */}
      {activeSection === 'debt' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agent Debt */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Users size={18} className="text-purple-600" />
                {t.agent_debt || 'Agent Debt'}
              </h3>
              {Object.keys(agentDebtMap).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {language === 'vi' ? 'Không có công nợ đại lý' : language === 'en' ? 'No agent debt' : '代理店債務なし'}
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.values(agentDebtMap).sort((a, b) => b.debt - a.debt).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{entry.name}</p>
                        <p className="text-xs text-gray-400">{entry.invoices.length} {language === 'vi' ? 'hóa đơn' : language === 'en' ? 'invoices' : '請求書'}</p>
                      </div>
                      <p className="font-bold text-red-600">{entry.debt.toLocaleString()}đ</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Retail Debt */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                {t.retail_debt || 'Retail Debt'}
              </h3>
              {(() => {
                const retailUnpaid = invoices.filter(i => i.type === 'RETAIL' && i.debtAmount > 0);
                if (retailUnpaid.length === 0) {
                  return (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {language === 'vi' ? 'Không có công nợ khách lẻ' : language === 'en' ? 'No retail debt' : '小売債務なし'}
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {retailUnpaid.sort((a, b) => b.debtAmount - a.debtAmount).map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{inv.customerName}</p>
                          <p className="text-xs text-gray-400">{inv.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{inv.debtAmount.toLocaleString()}đ</p>
                          {inv.dueDate && <p className="text-[10px] text-gray-400">{t.due_date || 'Due'}: {inv.dueDate}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Total Debt Summary */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.total_debt || 'Total Debt'}</p>
                <p className="text-2xl font-bold text-red-600">{totalDebt.toLocaleString()}đ</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.agent_debt || 'Agent Debt'}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Object.values(agentDebtMap).reduce((s, e) => s + e.debt, 0).toLocaleString()}đ
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.retail_debt || 'Retail Debt'}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {invoices.filter(i => i.type === 'RETAIL').reduce((s, i) => s + i.debtAmount, 0).toLocaleString()}đ
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.paid_invoices || 'Total Paid'}</p>
                <p className="text-2xl font-bold text-green-600">
                  {invoices.reduce((s, i) => s + i.paidAmount, 0).toLocaleString()}đ
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">{t.create_invoice || 'Create Invoice'}</h3>
                  <button onClick={() => { setShowCreateModal(false); setAgentSearch(''); setShowAgentDropdown(false); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <div className="space-y-4">
                  {/* Type */}
                  <div className="flex gap-3">
                    {(['RETAIL', 'AGENT'] as const).map(tp => (
                      <button key={tp} onClick={() => { setNewInvoice(p => ({ ...p, type: tp, agentId: tp === 'RETAIL' ? undefined : p.agentId, agentName: tp === 'RETAIL' ? undefined : p.agentName })); if (tp === 'RETAIL') { setAgentSearch(''); setShowAgentDropdown(false); } }}
                        className={cn("flex-1 py-3 rounded-xl font-bold text-sm transition-all", newInvoice.type === tp ? "bg-daiichi-red text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100")}>
                        {tp === 'RETAIL' ? (t.invoice_retail || 'Retail') : (t.invoice_agent || 'Agent')}
                      </button>
                    ))}
                  </div>

                  {/* Customer */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name || 'Customer Name'}</label>
                      <input type="text" value={newInvoice.customerName || ''} onChange={e => setNewInvoice(p => ({ ...p, customerName: e.target.value }))}
                        className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number || 'Phone'}</label>
                      <input type="tel" value={newInvoice.customerPhone || ''} onChange={e => setNewInvoice(p => ({ ...p, customerPhone: e.target.value }))}
                        className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm" />
                    </div>
                  </div>

                  {/* Agent Selector */}
                  {newInvoice.type === 'AGENT' && (
                    <div className="relative">
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.agents || 'Agent'}</label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          value={agentSearch}
                          onChange={e => {
                            setAgentSearch(e.target.value);
                            setShowAgentDropdown(true);
                            if (!e.target.value) {
                              setNewInvoice(p => ({ ...p, agentId: '', agentName: undefined }));
                            }
                          }}
                          onFocus={() => setShowAgentDropdown(true)}
                          onBlur={() => setTimeout(() => setShowAgentDropdown(false), 150)}
                          placeholder={language === 'vi' ? 'Tìm đại lý theo tên, mã, địa chỉ...' : language === 'en' ? 'Search agent by name, code, address...' : '代理店を検索...'}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-sm"
                        />
                        {newInvoice.agentId && (
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); setNewInvoice(p => ({ ...p, agentId: '', agentName: undefined })); setAgentSearch(''); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {showAgentDropdown && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                          {(() => {
                            const q = agentSearch.toLowerCase();
                            const filtered = agents.filter(ag =>
                              !q ||
                              ag.name.toLowerCase().includes(q) ||
                              ag.code.toLowerCase().includes(q) ||
                              (ag.address || '').toLowerCase().includes(q)
                            );
                            if (filtered.length === 0) return (
                              <div className="px-4 py-3 text-sm text-gray-400">
                                {language === 'vi' ? 'Không tìm thấy đại lý.' : language === 'en' ? 'No agents found.' : '代理店が見つかりません。'}
                              </div>
                            );
                            return filtered.map(ag => (
                              <button
                                key={ag.id}
                                type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setNewInvoice(p => ({ ...p, agentId: ag.id, agentName: ag.name, customerName: ag.name || p.customerName }));
                                  setAgentSearch(ag.name);
                                  setShowAgentDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors ${newInvoice.agentId === ag.id ? 'bg-daiichi-red/5' : ''}`}
                              >
                                <div className="text-sm font-semibold text-gray-800">{ag.name} <span className="text-xs font-normal text-gray-500">({ag.code})</span></div>
                                {ag.address && <div className="text-xs text-gray-400 truncate">{ag.address}</div>}
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                      {newInvoice.agentId && (() => {
                        const ag = agents.find(a => a.id === newInvoice.agentId);
                        return ag?.address ? (
                          <p className="mt-1 text-xs text-gray-400 pl-1">{ag.address}</p>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Invoice Items */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.invoice_items || 'Line Items'}</label>
                      <button onClick={() => setNewInvoice(p => ({ ...p, items: [...(p.items || []), emptyInvoiceItem()] }))}
                        className="text-xs text-daiichi-red font-bold hover:underline flex items-center gap-1">
                        <Plus size={14} /> {t.add_invoice_item || 'Add Line'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(newInvoice.items || []).map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <input type="text" value={item.description} onChange={e => {
                            const items = [...(newInvoice.items || [])];
                            items[idx] = { ...items[idx], description: e.target.value };
                            setNewInvoice(p => ({ ...p, items }));
                          }} placeholder={t.item_description || 'Description'} className="col-span-5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none" />
                          <input type="number" value={item.quantity} min={1} onChange={e => {
                            const items = [...(newInvoice.items || [])];
                            items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 1, total: (parseInt(e.target.value) || 1) * items[idx].unitPrice };
                            setNewInvoice(p => ({ ...p, items }));
                          }} placeholder="Qty" className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none text-center" />
                          <input type="number" value={item.unitPrice} min={0} onChange={e => {
                            const items = [...(newInvoice.items || [])];
                            items[idx] = { ...items[idx], unitPrice: parseFloat(e.target.value) || 0, total: items[idx].quantity * (parseFloat(e.target.value) || 0) };
                            setNewInvoice(p => ({ ...p, items }));
                          }} placeholder={t.unit_price || 'Price'} className="col-span-4 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none" />
                          <button onClick={() => {
                            const items = (newInvoice.items || []).filter((_, i) => i !== idx);
                            setNewInvoice(p => ({ ...p, items }));
                          }} className="col-span-1 flex justify-center text-gray-400 hover:text-red-500"><X size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discount / Tax / Due Date */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.discount || 'Discount'} (%)</label>
                      <input type="number" min={0} max={100} value={newInvoice.discount || 0} onChange={e => setNewInvoice(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
                        className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.tax || 'VAT'} (%)</label>
                      <input type="number" min={0} max={100} value={newInvoice.tax || 0} onChange={e => setNewInvoice(p => ({ ...p, tax: parseFloat(e.target.value) || 0 }))}
                        className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.due_date || 'Due Date'}</label>
                      <input type="date" value={newInvoice.dueDate || ''} onChange={e => setNewInvoice(p => ({ ...p, dueDate: e.target.value }))}
                        className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm" />
                    </div>
                  </div>

                  {/* Total preview */}
                  {(() => {
                    const { subtotal, total } = calcInvoiceTotals(newInvoice.items || [], newInvoice.discount || 0, newInvoice.tax || 0);
                    return (
                      <div className="p-4 bg-daiichi-accent/20 rounded-xl space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">{t.subtotal || 'Subtotal'}</span><span className="font-bold">{subtotal.toLocaleString()}đ</span></div>
                        {(newInvoice.discount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.discount || 'Discount'} ({newInvoice.discount}%)</span><span className="font-bold text-green-600">-{(subtotal * (newInvoice.discount || 0) / 100).toLocaleString()}đ</span></div>}
                        {(newInvoice.tax || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.tax || 'VAT'} ({newInvoice.tax}%)</span><span className="font-bold">+{((subtotal - subtotal * (newInvoice.discount || 0) / 100) * (newInvoice.tax || 0) / 100).toLocaleString()}đ</span></div>}
                        <div className="flex justify-between border-t border-daiichi-accent/30 pt-2"><span className="font-bold">{t.total_amount || 'Total'}</span><span className="text-xl font-bold text-daiichi-red">{total.toLocaleString()}đ</span></div>
                      </div>
                    );
                  })()}

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{language === 'vi' ? 'Ghi chú' : language === 'en' ? 'Notes' : 'メモ'}</label>
                    <textarea value={newInvoice.notes || ''} onChange={e => setNewInvoice(p => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm resize-none" />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setShowCreateModal(false); setAgentSearch(''); setShowAgentDropdown(false); }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                      {t.cancel || 'Cancel'}
                    </button>
                    <button onClick={handleCreateInvoice} className="flex-1 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all">
                      {t.create_invoice || 'Create Invoice'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVOICE DETAIL MODAL */}
      <AnimatePresence>
        {showInvoiceDetail && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{showInvoiceDetail.invoiceNumber}</h3>
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", statusColor[showInvoiceDetail.status])}>{statusLabel[showInvoiceDetail.status]}</span>
                  </div>
                  <button onClick={() => setShowInvoiceDetail(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-400 text-xs uppercase font-bold">{t.customer_name || 'Customer'}</p><p className="font-bold mt-1">{showInvoiceDetail.customerName}</p></div>
                    {showInvoiceDetail.customerPhone && <div><p className="text-gray-400 text-xs uppercase font-bold">{t.phone_number || 'Phone'}</p><p className="font-bold mt-1">{showInvoiceDetail.customerPhone}</p></div>}
                    {showInvoiceDetail.agentName && <div><p className="text-gray-400 text-xs uppercase font-bold">{t.agents || 'Agent'}</p><p className="font-bold mt-1">{showInvoiceDetail.agentName}</p></div>}
                    {showInvoiceDetail.dueDate && <div><p className="text-gray-400 text-xs uppercase font-bold">{t.due_date || 'Due'}</p><p className="font-bold mt-1">{showInvoiceDetail.dueDate}</p></div>}
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="py-2 px-3 text-left text-xs font-bold text-gray-400">{t.item_description || 'Description'}</th>
                        <th className="py-2 px-3 text-center text-xs font-bold text-gray-400">{t.item_quantity || 'Qty'}</th>
                        <th className="py-2 px-3 text-right text-xs font-bold text-gray-400">{t.unit_price || 'Unit Price'}</th>
                        <th className="py-2 px-3 text-right text-xs font-bold text-gray-400">{t.total_amount || 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showInvoiceDetail.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 px-3">{item.description}</td>
                          <td className="py-2 px-3 text-center">{item.quantity}</td>
                          <td className="py-2 px-3 text-right">{item.unitPrice.toLocaleString()}đ</td>
                          <td className="py-2 px-3 text-right font-bold">{item.total.toLocaleString()}đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">{t.subtotal || 'Subtotal'}</span><span>{showInvoiceDetail.subtotal.toLocaleString()}đ</span></div>
                    {showInvoiceDetail.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">{t.discount || 'Discount'} ({showInvoiceDetail.discount}%)</span><span className="text-green-600">-{(showInvoiceDetail.subtotal * showInvoiceDetail.discount / 100).toLocaleString()}đ</span></div>}
                    {showInvoiceDetail.tax > 0 && <div className="flex justify-between"><span className="text-gray-500">{t.tax || 'VAT'} ({showInvoiceDetail.tax}%)</span><span>+{((showInvoiceDetail.subtotal - showInvoiceDetail.subtotal * showInvoiceDetail.discount / 100) * showInvoiceDetail.tax / 100).toLocaleString()}đ</span></div>}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-bold"><span>{t.total_amount || 'Total'}</span><span className="text-daiichi-red">{showInvoiceDetail.total.toLocaleString()}đ</span></div>
                    <div className="flex justify-between text-green-600"><span>{t.paid_amount || 'Paid'}</span><span className="font-bold">{showInvoiceDetail.paidAmount.toLocaleString()}đ</span></div>
                    <div className="flex justify-between text-red-600"><span>{t.debt_amount || 'Debt'}</span><span className="font-bold">{showInvoiceDetail.debtAmount.toLocaleString()}đ</span></div>
                  </div>

                  {showInvoiceDetail.notes && (
                    <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">{showInvoiceDetail.notes}</div>
                  )}

                  {showInvoiceDetail.status !== 'PAID' && (
                    <button onClick={() => { setShowPaymentModal(showInvoiceDetail); setShowInvoiceDetail(null); setPaymentInput(''); }}
                      className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all">
                      {t.record_payment || 'Record Payment'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">{t.record_payment || 'Record Payment'}</h3>
                <button onClick={() => setShowPaymentModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-bold text-gray-700">{showPaymentModal.customerName}</p>
                  <p className="text-xs text-gray-400">{showPaymentModal.invoiceNumber}</p>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-500">{t.debt_amount || 'Remaining'}</span>
                    <span className="font-bold text-red-600">{showPaymentModal.debtAmount.toLocaleString()}đ</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.payment_amount || 'Payment Amount'}</label>
                  <input
                    type="number"
                    value={paymentInput}
                    onChange={e => setPaymentInput(e.target.value)}
                    min={1}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 text-lg font-bold"
                    placeholder="0"
                    autoFocus
                  />
                  <button onClick={() => setPaymentInput(showPaymentModal.debtAmount.toString())} className="text-xs text-daiichi-red font-bold hover:underline mt-1">
                    {language === 'vi' ? 'Thanh toán đủ' : language === 'en' ? 'Pay in full' : '全額支払い'}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPaymentModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                    {t.cancel || 'Cancel'}
                  </button>
                  <button onClick={handleRecordPayment} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all">
                    {t.save || 'Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
