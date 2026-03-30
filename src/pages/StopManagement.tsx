import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Edit3, MapPin, Search, Save, X, Filter, Building2, Navigation, Copy, ChevronDown, ChevronRight, Gift } from 'lucide-react';
import { Language, TRANSLATIONS } from '../constants/translations';
import { Stop, User, UserRole } from '../types';
import { transportService } from '../services/transportService';
import { ResizableTh } from '../components/ResizableTh';
import { NotePopover } from '../components/NotePopover';
import { matchesSearch } from '../lib/searchUtils';
import { cn } from '../lib/utils';

interface StopManagementProps {
  language: Language;
  stops: Stop[];
  onUpdateStops: (stops: Stop[]) => void;
  currentUser?: User | null;
}

const CATEGORY_LABELS: Record<NonNullable<Stop['category']>, Record<Language, string>> = {
  MAJOR:      { vi: 'Điểm dừng lớn',    en: 'Major Stop',    ja: '主要停留所' },
  MINOR:      { vi: 'Điểm dừng nhỏ',    en: 'Minor Stop',    ja: '簡易停留所' },
  TOLL:       { vi: 'Trạm thu phí',      en: 'Toll Booth',    ja: '料金所' },
  RESTAURANT: { vi: 'Nhà hàng',          en: 'Restaurant',    ja: 'レストラン' },
  QUICK:      { vi: 'Dừng nhanh',        en: 'Quick Stop',    ja: '一時停止点' },
  TRANSIT:    { vi: 'Trung chuyển',      en: 'Transit Point', ja: '乗り換え地点' },
  OFFICE:     { vi: 'Phòng vé',          en: 'Ticket Office', ja: 'チケット売り場' },
  FREE:       { vi: 'Miễn phí',          en: 'Free',          ja: '無料' },
};

const ROUTE_CATEGORY_LABELS: Record<NonNullable<Stop['vehicleTypes']>, Record<Language, string>> = {
  BUS:        { vi: '🚌 Xe bus',     en: '🚌 Bus',        ja: '🚌 バス' },
  TOUR_SHORT: { vi: '🗺️ Tour',       en: '🗺️ Day Tour',   ja: '🗺️ 日帰りツアー' },
  CRUISE:     { vi: '⚓ Du thuyền',  en: '⚓ Cruise',      ja: '⚓ クルーズ' },
  HOTEL:      { vi: '🏨 Khách sạn', en: '🏨 Hotel',       ja: '🏨 ホテル' },
};

const EMPTY_FORM: Omit<Stop, 'id'> = {
  name: '',
  address: '',
  category: 'MAJOR',
  surcharge: 0,
  distanceKm: undefined,
  type: 'STOP',
  terminalId: undefined,
  priority: undefined,
  vehicleTypes: undefined,
  stt: undefined,
};

interface CopyModal {
  stop: Stop;
  mode: 'new' | 'existing';
  targetTerminalId: string;
}

export const StopManagement: React.FC<StopManagementProps> = ({ language, stops, onUpdateStops, currentUser }) => {
  const t = TRANSLATIONS[language];
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStopFilters, setShowStopFilters] = useState(false);
  const [stopCategoryFilter, setStopCategoryFilter] = useState<'ALL' | Stop['category']>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TERMINAL' | 'STOP' | 'FREE_STOP'>('ALL');
  const [copyModal, setCopyModal] = useState<CopyModal | null>(null);

  const [collapsedTerminals, setCollapsedTerminals] = useState<Set<string>>(new Set());

  const toggleTerminalCollapse = (terminalId: string) => {
    setCollapsedTerminals(prev => {
      const next = new Set(prev);
      if (next.has(terminalId)) next.delete(terminalId);
      else next.add(terminalId);
      return next;
    });
  };

  const [colWidths, setColWidths] = useState({
    stt: 70,
    name: 220,
    type: 120,
    terminal: 180,
    category: 140,
    vehicleTypes: 180,
    address: 240,
    surcharge: 130,
    actions: 148,
  });

  const [formData, setFormData] = useState<Omit<Stop, 'id'>>(EMPTY_FORM);

  const editRowRef = useRef<HTMLTableRowElement>(null);

  const terminalStops = stops.filter(s => s.type === 'TERMINAL');

  const checkDuplicate = (name: string, type: Stop['type'], terminalId: string | undefined, excludeId?: string): boolean => {
    const normalized = name.trim().toLowerCase();
    if (type === 'TERMINAL') {
      return stops.some(s =>
        s.type === 'TERMINAL' &&
        s.id !== excludeId &&
        s.name.trim().toLowerCase() === normalized
      );
    }
    return stops.some(s =>
      s.type !== 'TERMINAL' &&
      s.id !== excludeId &&
      (s.terminalId ?? undefined) === (terminalId ?? undefined) &&
      s.name.trim().toLowerCase() === normalized
    );
  };

  const duplicateAlert = (type: Stop['type']) => {
    if (type === 'TERMINAL') {
      alert(language === 'vi'
        ? 'Ga/Bến này đã tồn tại. Vui lòng chọn tên khác.'
        : language === 'ja'
        ? 'このターミナルは既に存在します。別の名前を選んでください。'
        : 'This terminal already exists. Please choose a different name.');
    } else {
      alert(language === 'vi'
        ? 'Điểm dừng này đã tồn tại trong ga/bến đó. Vui lòng chọn tên khác.'
        : language === 'ja'
        ? 'この停留所は既にそのターミナル内に存在します。別の名前を選んでください。'
        : 'This stop already exists under that terminal. Please choose a different name.');
    }
  };

  const handleAddStop = async () => {
    if (!formData.name || !formData.address) return;
    const dataToSave = formData.type === 'TERMINAL'
      ? { ...formData, terminalId: undefined }
      : { ...formData, vehicleTypes: undefined };
    if (checkDuplicate(dataToSave.name, dataToSave.type, dataToSave.terminalId)) {
      duplicateAlert(dataToSave.type);
      return;
    }
    try {
      await transportService.addStop(dataToSave);
    } catch {
      const newStop: Stop = { ...dataToSave, id: Date.now().toString() };
      onUpdateStops([newStop, ...stops]);
    }
    resetForm();
  };

  const handleUpdateStop = async () => {
    if (!editingId || !formData.name || !formData.address) return;
    const dataToSave = formData.type === 'TERMINAL'
      ? { ...formData, terminalId: undefined }
      : { ...formData, vehicleTypes: undefined };
    if (checkDuplicate(dataToSave.name, dataToSave.type, dataToSave.terminalId, editingId)) {
      duplicateAlert(dataToSave.type);
      return;
    }
    try {
      await transportService.updateStop(editingId, dataToSave);
    } catch {
      onUpdateStops(stops.map(s => s.id === editingId ? { ...dataToSave, id: editingId } : s));
    }
    resetForm();
  };

  const handleDeleteStop = async (id: string) => {
    const stop = stops.find(s => s.id === id);
    const isTerminal = stop?.type === 'TERMINAL';
    const hasChildren = isTerminal && stops.some(s => s.terminalId === id);
    if (hasChildren) {
      alert(language === 'vi'
        ? 'Không thể xóa ga/bến này vì còn điểm dừng con. Hãy xóa các điểm con trước.'
        : 'Cannot delete this terminal because it still has child stops. Remove child stops first.');
      return;
    }
    if (!confirm(language === 'vi' ? 'Bạn có chắc chắn muốn xóa điểm dừng này?' : 'Are you sure you want to delete this stop?')) return;
    try {
      await transportService.deleteStop(id);
    } catch {
      onUpdateStops(stops.filter(s => s.id !== id));
    }
  };

  const handleCopyStop = (stop: Stop) => {
    const otherTerminals = stops.filter(s => s.type === 'TERMINAL' && s.id !== stop.id);
    setCopyModal({
      stop,
      mode: 'new',
      targetTerminalId: otherTerminals[0]?.id ?? '',
    });
  };

  const handleConfirmCopy = async () => {
    if (!copyModal) return;
    const { stop, mode, targetTerminalId } = copyModal;
    const isTerminal = stop.type === 'TERMINAL';
    const children = isTerminal ? stops.filter(s => s.terminalId === stop.id) : [];

    const COPY_SUFFIX: Record<Language, string> = {
      vi: ' (bản sao)',
      en: ' (copy)',
      ja: '（コピー）',
    };
    const copySuffix = COPY_SUFFIX[language];

    setCopyModal(null);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...stopData } = stop;

    if (isTerminal) {
      if (mode === 'new') {
        // Copy terminal → create new terminal + copy all children under it
        const newTerminalData: Omit<Stop, 'id'> = {
          ...stopData,
          name: `${stop.name}${copySuffix}`,
          terminalId: undefined,
        };
        try {
          const newTerminalRef = await transportService.addStop(newTerminalData);
          if (newTerminalRef && children.length > 0) {
            await Promise.all(children.map(child => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id: _cid, ...childData } = child;
              return transportService.addStop({
                ...childData,
                name: `${child.name}${copySuffix}`,
                terminalId: newTerminalRef.id,
              });
            }));
          }
        } catch {
          const newId = Date.now().toString();
          const newStop: Stop = { ...newTerminalData, id: newId };
          const childCopies: Stop[] = children.map((child, i) => ({
            ...child,
            id: `${newId}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            name: `${child.name}${copySuffix}`,
            terminalId: newId,
          }));
          onUpdateStops([...stops, newStop, ...childCopies]);
        }
      } else {
        // Copy children → add all child stops to an existing terminal
        if (!targetTerminalId) return;
        try {
          await Promise.all(children.map(child => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _cid, ...childData } = child;
            return transportService.addStop({
              ...childData,
              name: child.name,
              terminalId: targetTerminalId,
            });
          }));
        } catch {
          const newId = Date.now().toString();
          const childCopies: Stop[] = children.map((child, i) => ({
            ...child,
            id: `${newId}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            name: child.name,
            terminalId: targetTerminalId,
          }));
          onUpdateStops([...stops, ...childCopies]);
        }
      }
    } else {
      // Copying a non-terminal STOP
      const newStopData: Omit<Stop, 'id'> = {
        ...stopData,
        name: `${stop.name}${copySuffix}`,
        terminalId: mode === 'existing' && targetTerminalId ? targetTerminalId : stop.terminalId,
      };
      try {
        await transportService.addStop(newStopData);
      } catch {
        onUpdateStops([...stops, { ...newStopData, id: Date.now().toString() }]);
      }
    }
  };

  const startEdit = (stop: Stop) => {
    setEditingId(stop.id);
    setFormData({
      name: stop.name,
      address: stop.address,
      category: stop.category ?? 'MAJOR',
      surcharge: stop.surcharge,
      distanceKm: stop.distanceKm,
      type: stop.type ?? 'STOP',
      terminalId: stop.terminalId,
      priority: stop.priority,
      vehicleTypes: stop.vehicleTypes,
      stt: stop.stt,
    });
    setIsAdding(true);
  };

  // Scroll inline edit form into view after it renders
  useEffect(() => {
    if (editingId) {
      editRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [editingId]);

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSaveStopNote = async (stopId: string, note: string) => {
    try {
      await transportService.updateStop(stopId, { note });
    } catch (err) {
      console.error('Failed to save stop note:', err);
      onUpdateStops(stops.map(s => s.id === stopId ? { ...s, note } : s));
    }
  };

  const filteredStops = stops.filter(s => {
    if (typeFilter !== 'ALL') {
      const effectiveType = s.type ?? 'STOP';
      if (effectiveType !== typeFilter) return false;
    }
    if (stopCategoryFilter !== 'ALL' && s.category !== stopCategoryFilter) return false;
    const terminalName = terminalStops.find(t => t.id === s.terminalId)?.name ?? '';
    return (
      matchesSearch(s.name, searchTerm) ||
      matchesSearch(s.address, searchTerm) ||
      matchesSearch(s.category ?? '', searchTerm) ||
      matchesSearch(terminalName, searchTerm)
    );
  });

  // Group: terminals first (sorted by stt), then their children sorted by stt, then unaffiliated stops sorted by stt
  const sortedDisplay = (() => {
    const byStt = (a: Stop, b: Stop) => {
      const aStt = a.stt ?? Infinity;
      const bStt = b.stt ?? Infinity;
      return aStt - bStt;
    };
    const terminals = filteredStops.filter(s => s.type === 'TERMINAL').sort(byStt);
    const childMap: Record<string, Stop[]> = {};
    filteredStops.filter(s => s.type !== 'TERMINAL' && s.terminalId).forEach(s => {
      if (!childMap[s.terminalId!]) childMap[s.terminalId!] = [];
      childMap[s.terminalId!].push(s);
    });
    const unaffiliated = filteredStops.filter(s => s.type !== 'TERMINAL' && !s.terminalId).sort(byStt);

    const rows: { stop: Stop; isChild: boolean; childCount: number }[] = [];
    terminals.forEach(terminal => {
      const children = (childMap[terminal.id] || []).sort(byStt);
      rows.push({ stop: terminal, isChild: false, childCount: children.length });
      if (!collapsedTerminals.has(terminal.id)) {
        children.forEach(child => rows.push({ stop: child, isChild: true, childCount: 0 }));
      }
    });
    unaffiliated.forEach(s => rows.push({ stop: s, isChild: false, childCount: 0 }));
    return rows;
  })();

  const handleEditToggle = (stop: Stop) => {
    if (editingId === stop.id) {
      resetForm();
    } else {
      startEdit(stop);
    }
  };

  const stopTypeLabel = (type: Stop['type']) => {
    if (type === 'TERMINAL') return language === 'vi' ? 'Ga/Bến' : language === 'ja' ? 'ターミナル' : 'Terminal';
    if (type === 'FREE_STOP') return language === 'vi' ? 'Miễn phí' : language === 'ja' ? '無料乗降' : 'Free';
    return language === 'vi' ? 'Điểm dừng' : language === 'ja' ? '停留所' : 'Stop';
  };

  const terminalName = (terminalId?: string) => terminalStops.find(t => t.id === terminalId)?.name ?? '—';

  const activeFilterCount = (typeFilter !== 'ALL' ? 1 : 0) + (stopCategoryFilter !== 'ALL' ? 1 : 0);

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t.stop_management}</h2>
          <p className="text-sm text-gray-500">
            {language === 'vi'
              ? 'Quản lý ga/bến (cấp cao nhất) và các điểm đón/trả con trên toàn hệ thống'
              : 'Manage terminals (top-level) and their pickup / dropoff sub-stops'}
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 flex items-center gap-2 hover:scale-105 transition-all"
        >
          <Plus size={20} />
          {t.add_stop}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl text-xs font-semibold text-indigo-700">
          <Building2 size={14} />
          {language === 'vi' ? 'Ga/Bến — điểm xuất phát hoặc điểm đến' : 'Terminal — departure or arrival station'}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-xl text-xs font-semibold text-teal-700">
          <Navigation size={14} />
          {language === 'vi' ? 'Điểm dừng — điểm đón/trả thuộc ga/bến' : 'Stop — pickup/dropoff belonging to a terminal'}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-xl text-xs font-semibold text-orange-700">
          <Gift size={14} />
          {language === 'vi' ? 'Miễn phí — đón/trả miễn phí thuộc ga/bến' : 'Free — free pickup/dropoff belonging to a terminal'}
        </div>
      </div>

      {/* Add Form (only when adding a new stop, not editing) */}
      {isAdding && !editingId && (
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">
              {editingId
                ? (language === 'vi' ? 'Chỉnh sửa điểm dừng' : 'Edit Stop')
                : t.add_stop}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                {language === 'vi' ? 'Cấp điểm dừng' : 'Stop Level'}
              </label>
              <div className="flex rounded-xl overflow-hidden border border-gray-100">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: 'TERMINAL', terminalId: undefined }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all',
                    formData.type === 'TERMINAL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <Building2 size={16} />
                  {language === 'vi' ? 'Ga/Bến' : 'Terminal'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: 'STOP' }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all',
                    formData.type !== 'TERMINAL' && formData.type !== 'FREE_STOP'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <Navigation size={16} />
                  {language === 'vi' ? 'Điểm dừng' : 'Stop'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: 'FREE_STOP' }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all',
                    formData.type === 'FREE_STOP'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  )}
                >
                  <Gift size={16} />
                  {language === 'vi' ? 'Miễn phí' : 'Free'}
                </button>
              </div>
            </div>

            {/* Parent terminal selector (only for STOP) */}
            {formData.type !== 'TERMINAL' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Ga/Bến cha' : 'Parent Terminal'}
                </label>
                <select
                  value={formData.terminalId ?? ''}
                  onChange={e => setFormData(p => ({ ...p, terminalId: e.target.value || undefined }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
                >
                  <option value="">{language === 'vi' ? '— Không thuộc ga nào —' : '— No terminal —'}</option>
                  {terminalStops.map(ts => (
                    <option key={ts.id} value={ts.id}>{ts.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.stop_name}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={
                  formData.type === 'TERMINAL'
                    ? (language === 'vi' ? 'Ví dụ: Hà Nội, Hải Phòng...' : 'e.g. Hanoi, Haiphong...')
                    : (language === 'vi' ? 'Ví dụ: Văn phòng Hà Nội' : 'e.g. Hanoi Office')
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.stop_address}</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={language === 'vi' ? 'Địa chỉ chi tiết...' : 'Detailed address...'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                {language === 'vi' ? 'Loại điểm' : 'Category'}
              </label>
              <select
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as Stop['category'] }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
              >
                {(Object.keys(CATEGORY_LABELS) as Stop['category'][]).map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat][language]}</option>
                ))}
              </select>
            </div>
            {formData.type === 'TERMINAL' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Phân loại' : language === 'ja' ? '分類' : 'Classification'}
                </label>
                <select
                  value={formData.vehicleTypes ?? ''}
                  onChange={e => setFormData(prev => ({ ...prev, vehicleTypes: (e.target.value || undefined) as Stop['vehicleTypes'] }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
                >
                  <option value="">{language === 'vi' ? '— Chưa phân loại —' : language === 'ja' ? '— 未分類 —' : '— Not classified —'}</option>
                  {(Object.keys(ROUTE_CATEGORY_LABELS) as NonNullable<Stop['vehicleTypes']>[]).map(cat => (
                    <option key={cat} value={cat}>{ROUTE_CATEGORY_LABELS[cat][language]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.surcharge} (đ)</label>
              <input
                type="number"
                value={formData.surcharge || ''}
                onChange={e => setFormData(prev => ({ ...prev, surcharge: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder=""
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                {language === 'vi' ? 'Khoảng cách (km)' : language === 'ja' ? '距離 (km)' : 'Distance (km)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.distanceKm ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, distanceKm: e.target.value ? parseFloat(e.target.value) : undefined }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={language === 'vi' ? 'Tuỳ chọn' : 'Optional'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                {language === 'vi' ? 'Ưu tiên tìm kiếm' : language === 'ja' ? '検索優先度' : 'Search Priority'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.priority ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value ? parseInt(e.target.value) : undefined }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={language === 'vi' ? 'Tuỳ chọn (1 = cao nhất)' : language === 'ja' ? '任意 (1 = 最高)' : 'Optional (1 = highest)'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                {language === 'vi' ? 'Số thứ tự (STT)' : language === 'ja' ? '順番号 (STT)' : 'Order No. (STT)'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.stt ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, stt: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                placeholder={language === 'vi' ? 'Tuỳ chọn' : 'Optional'}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button onClick={resetForm} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">
              {t.cancel}
            </button>
            <button
              onClick={editingId ? handleUpdateStop : handleAddStop}
              disabled={!formData.name || !formData.address}
              className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
            >
              <Save size={18} />
              {editingId ? t.update : t.save}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-6 border-b border-gray-50 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={language === 'vi' ? 'Tìm kiếm điểm dừng...' : 'Search stops...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
              />
            </div>
            <button
              onClick={() => setShowStopFilters(p => !p)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all',
                showStopFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Filter size={15} />
              {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">{activeFilterCount}</span>
              )}
            </button>
            {(searchTerm || activeFilterCount > 0) && (
              <button
                onClick={() => { setSearchTerm(''); setStopCategoryFilter('ALL'); setTypeFilter('ALL'); }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              >
                <X size={14} />
                {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
              </button>
            )}
            <span className="px-4 py-3 bg-gray-50 rounded-2xl text-xs font-bold text-gray-500 border border-gray-100 flex items-center">
              {filteredStops.length} {language === 'vi' ? 'điểm dừng' : 'stops'}
            </span>
          </div>

          {showStopFilters && (
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  {language === 'vi' ? 'Cấp điểm dừng' : 'Stop Level'}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['ALL', 'TERMINAL', 'STOP', 'FREE_STOP'] as const).map(tp => (
                    <button
                      key={tp}
                      onClick={() => setTypeFilter(tp)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        typeFilter === tp
                          ? 'bg-daiichi-red text-white ring-2 ring-daiichi-red'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {tp === 'ALL'
                        ? (language === 'vi' ? 'Tất cả' : 'All')
                        : tp === 'TERMINAL'
                          ? (language === 'vi' ? 'Ga/Bến' : 'Terminal')
                          : tp === 'FREE_STOP'
                            ? (language === 'vi' ? 'Miễn phí' : 'Free')
                            : (language === 'vi' ? 'Điểm dừng' : 'Stop')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  {language === 'vi' ? 'Loại điểm dừng' : 'Category'}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['ALL', ...Object.keys(CATEGORY_LABELS)] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setStopCategoryFilter(cat as 'ALL' | Stop['category'])}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        stopCategoryFilter === cat
                          ? 'bg-daiichi-red text-white ring-2 ring-daiichi-red'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {cat === 'ALL'
                        ? (language === 'vi' ? 'Tất cả' : 'All')
                        : CATEGORY_LABELS[cat as Stop['category']][language]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <ResizableTh width={colWidths.stt} onResize={(w) => setColWidths(p => ({ ...p, stt: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">STT</ResizableTh>
                <ResizableTh width={colWidths.name} onResize={(w) => setColWidths(p => ({ ...p, name: w }))} className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.stop_name}</ResizableTh>
                <ResizableTh width={colWidths.type} onResize={(w) => setColWidths(p => ({ ...p, type: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {language === 'vi' ? 'Cấp' : 'Level'}
                </ResizableTh>
                <ResizableTh width={colWidths.terminal} onResize={(w) => setColWidths(p => ({ ...p, terminal: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {language === 'vi' ? 'Ga/Bến cha' : 'Parent Terminal'}
                </ResizableTh>
                <ResizableTh width={colWidths.category} onResize={(w) => setColWidths(p => ({ ...p, category: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {language === 'vi' ? 'Loại điểm' : 'Category'}
                </ResizableTh>
                <ResizableTh width={colWidths.vehicleTypes} onResize={(w) => setColWidths(p => ({ ...p, vehicleTypes: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {language === 'vi' ? 'Phân loại' : language === 'ja' ? '分類' : 'Classification'}
                </ResizableTh>
                <ResizableTh width={colWidths.address} onResize={(w) => setColWidths(p => ({ ...p, address: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.stop_address}</ResizableTh>
                <ResizableTh width={colWidths.surcharge} onResize={(w) => setColWidths(p => ({ ...p, surcharge: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.surcharge}</ResizableTh>
                <ResizableTh width={colWidths.actions} onResize={(w) => setColWidths(p => ({ ...p, actions: w }))} className="px-4 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">{t.actions}</ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedDisplay.map(({ stop, isChild, childCount }) => {
                const isTerminal = stop.type === 'TERMINAL';
                const isFreeStop = stop.type === 'FREE_STOP';
                const isCollapsed = isTerminal && collapsedTerminals.has(stop.id);
                const isEditing = editingId === stop.id;
                return (
                  <React.Fragment key={stop.id}>
                    <tr
                      className={cn(
                        'hover:bg-gray-50 transition-colors group',
                        isTerminal && 'bg-indigo-50/40',
                        isEditing && 'ring-2 ring-inset ring-daiichi-red/30'
                      )}
                    >
                      {/* STT */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-sm font-semibold text-gray-500">
                          {stop.stt ?? '—'}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-8 py-5">
                        <div className={cn('flex items-center gap-3', isChild && 'pl-5')}>
                          {isChild && <span className="text-gray-300 text-base leading-none">└</span>}
                          {isTerminal && childCount > 0 && (
                            <button
                              onClick={() => toggleTerminalCollapse(stop.id)}
                              title={isCollapsed
                                ? (language === 'vi' ? 'Mở rộng điểm dừng con' : 'Expand child stops')
                                : (language === 'vi' ? 'Thu gọn điểm dừng con' : 'Collapse child stops')}
                              aria-label={isCollapsed
                                ? (language === 'vi' ? 'Mở rộng điểm dừng con' : 'Expand child stops')
                                : (language === 'vi' ? 'Thu gọn điểm dừng con' : 'Collapse child stops')}
                              className="w-5 h-5 flex items-center justify-center text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                            >
                              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                          {isTerminal && childCount === 0 && (
                            <span className="w-5 h-5 flex-shrink-0" />
                          )}
                          <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                            isTerminal ? 'bg-indigo-100 text-indigo-600' : isFreeStop ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600'
                          )}>
                            {isTerminal ? <Building2 size={18} /> : isFreeStop ? <Gift size={18} /> : <MapPin size={18} />}
                          </div>
                          <span className={cn('font-bold text-gray-800', isTerminal && 'text-indigo-800')}>{stop.name}</span>
                          {isTerminal && childCount > 0 && isCollapsed && (
                            <span className="text-xs font-normal text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
                              {childCount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Level badge */}
                      <td className="px-4 py-5">
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-lg',
                          isTerminal ? 'bg-indigo-100 text-indigo-700' : isFreeStop ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
                        )}>
                          {stopTypeLabel(stop.type)}
                        </span>
                      </td>

                      {/* Parent terminal */}
                      <td className="px-4 py-5">
                        {isTerminal ? (
                          <span className="text-xs text-gray-300 italic">—</span>
                        ) : stop.terminalId ? (
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                            {terminalName(stop.terminalId)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            {language === 'vi' ? 'Chưa gắn ga' : 'No terminal'}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-5">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                          {CATEGORY_LABELS[stop.category ?? 'MAJOR'][language]}
                        </span>
                      </td>

                      {/* Classification */}
                      <td className="px-4 py-5">
                        {isTerminal && stop.vehicleTypes ? (
                          <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                            {ROUTE_CATEGORY_LABELS[stop.vehicleTypes]?.[language] ?? '?'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="px-4 py-5 text-sm text-gray-500">{stop.address}</td>

                      {/* Surcharge */}
                      <td className="px-4 py-5">
                        <span className="text-sm font-bold text-daiichi-red">
                          {stop.surcharge > 0 ? `+${stop.surcharge.toLocaleString()}đ` : '0đ'}
                          {stop.distanceKm !== undefined && stop.distanceKm > 0 && (
                            <span className="ml-1 text-xs font-normal text-gray-400">({stop.distanceKm}km)</span>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleCopyStop(stop)}
                            title={t.copy_stop}
                            className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={() => handleEditToggle(stop)}
                            className={cn(
                              'p-2 rounded-lg transition-all',
                              isEditing
                                ? 'text-daiichi-red bg-daiichi-red/10 hover:bg-daiichi-red/20'
                                : 'text-gray-600 hover:text-daiichi-red hover:bg-daiichi-red/5'
                            )}
                          >
                            <Edit3 size={18} />
                          </button>
                          <NotePopover note={stop.note} onSave={(note) => handleSaveStopNote(stop.id, note)} language={language} />
                          {isAdmin && (
                          <button
                            onClick={() => handleDeleteStop(stop.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline Edit Form — appears right below the row being edited */}
                    {isEditing && (
                      <tr ref={editRowRef}>
                        <td colSpan={9} className="px-4 py-4 bg-gray-50/80 border-b border-gray-100">
                          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-bold">
                                {language === 'vi' ? 'Chỉnh sửa điểm dừng' : 'Edit Stop'}
                              </h3>
                              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
                            </div>

                            {/* Type selector */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                  {language === 'vi' ? 'Cấp điểm dừng' : 'Stop Level'}
                                </label>
                                <div className="flex rounded-xl overflow-hidden border border-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, type: 'TERMINAL', terminalId: undefined }))}
                                    className={cn(
                                      'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all',
                                      formData.type === 'TERMINAL'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    )}
                                  >
                                    <Building2 size={16} />
                                    {language === 'vi' ? 'Ga/Bến' : 'Terminal'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, type: 'STOP' }))}
                                    className={cn(
                                      'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all',
                                      formData.type !== 'TERMINAL'
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    )}
                                  >
                                    <Navigation size={16} />
                                    {language === 'vi' ? 'Điểm dừng' : 'Stop'}
                                  </button>
                                </div>
                              </div>

                              {/* Parent terminal selector (only for STOP) */}
                              {formData.type !== 'TERMINAL' && (
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                    {language === 'vi' ? 'Ga/Bến cha' : 'Parent Terminal'}
                                  </label>
                                  <select
                                    value={formData.terminalId ?? ''}
                                    onChange={e => setFormData(p => ({ ...p, terminalId: e.target.value || undefined }))}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
                                  >
                                    <option value="">{language === 'vi' ? '— Không thuộc ga nào —' : '— No terminal —'}</option>
                                    {terminalStops.map(ts => (
                                      <option key={ts.id} value={ts.id}>{ts.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.stop_name}</label>
                                <input
                                  type="text"
                                  value={formData.name}
                                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                                  placeholder={
                                    formData.type === 'TERMINAL'
                                      ? (language === 'vi' ? 'Ví dụ: Hà Nội, Hải Phòng...' : 'e.g. Hanoi, Haiphong...')
                                      : (language === 'vi' ? 'Ví dụ: Văn phòng Hà Nội' : 'e.g. Hanoi Office')
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.stop_address}</label>
                                <input
                                  type="text"
                                  value={formData.address}
                                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                                  placeholder={language === 'vi' ? 'Địa chỉ chi tiết...' : 'Detailed address...'}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                  {language === 'vi' ? 'Loại điểm' : 'Category'}
                                </label>
                                <select
                                  value={formData.category}
                                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as Stop['category'] }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
                                >
                                  {(Object.keys(CATEGORY_LABELS) as Stop['category'][]).map(cat => (
                                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat][language]}</option>
                                  ))}
                                </select>
                              </div>
                              {formData.type === 'TERMINAL' && (
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                    {language === 'vi' ? 'Phân loại' : language === 'ja' ? '分類' : 'Classification'}
                                  </label>
                                  <select
                                    value={formData.vehicleTypes ?? ''}
                                    onChange={e => setFormData(prev => ({ ...prev, vehicleTypes: (e.target.value || undefined) as Stop['vehicleTypes'] }))}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
                                  >
                                    <option value="">{language === 'vi' ? '— Chưa phân loại —' : language === 'ja' ? '— 未分類 —' : '— Not classified —'}</option>
                                    {(Object.keys(ROUTE_CATEGORY_LABELS) as NonNullable<Stop['vehicleTypes']>[]).map(cat => (
                                      <option key={cat} value={cat}>{ROUTE_CATEGORY_LABELS[cat][language]}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.surcharge} (đ)</label>
                                <input
                                  type="number"
                                  value={formData.surcharge || ''}
                                  onChange={e => setFormData(prev => ({ ...prev, surcharge: parseInt(e.target.value) || 0 }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                                  placeholder=""
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                  {language === 'vi' ? 'Khoảng cách (km)' : language === 'ja' ? '距離 (km)' : 'Distance (km)'}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={formData.distanceKm ?? ''}
                                  onChange={e => setFormData(prev => ({ ...prev, distanceKm: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                                  placeholder={language === 'vi' ? 'Tuỳ chọn' : 'Optional'}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                  {language === 'vi' ? 'Ưu tiên tìm kiếm' : language === 'ja' ? '検索優先度' : 'Search Priority'}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={formData.priority ?? ''}
                                  onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value ? parseInt(e.target.value) : undefined }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                                  placeholder={language === 'vi' ? 'Tuỳ chọn (1 = cao nhất)' : language === 'ja' ? '任意 (1 = 最高)' : 'Optional (1 = highest)'}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                  {language === 'vi' ? 'Số thứ tự (STT)' : language === 'ja' ? '順番号 (STT)' : 'Order No. (STT)'}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={formData.stt ?? ''}
                                  onChange={e => setFormData(prev => ({ ...prev, stt: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none"
                                  placeholder={language === 'vi' ? 'Tuỳ chọn' : 'Optional'}
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-4 pt-2">
                              <button onClick={resetForm} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">
                                {t.cancel}
                              </button>
                              <button
                                onClick={handleUpdateStop}
                                disabled={!formData.name || !formData.address}
                                className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                              >
                                <Save size={18} />
                                {t.update}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {sortedDisplay.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-12 text-center text-gray-400">
                    {language === 'vi' ? 'Không tìm thấy điểm dừng nào' : 'No stops found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Copy Stop Modal */}
      {copyModal && (() => {
        const isTerminal = copyModal.stop.type === 'TERMINAL';
        const children = isTerminal ? stops.filter(s => s.terminalId === copyModal.stop.id) : [];
        const otherTerminals = stops.filter(s => s.type === 'TERMINAL' && s.id !== copyModal.stop.id);
        const hasOtherTerminals = otherTerminals.length > 0;
        const firstOtherTerminalId = otherTerminals[0]?.id ?? '';

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">{t.copy_stop_modal_title}</h3>
                <button onClick={() => setCopyModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-700">
                  {isTerminal ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={15} className="text-indigo-500" />
                      {copyModal.stop.name}
                      {children.length > 0 && (
                        <span className="text-xs font-normal text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
                          {children.length} {language === 'vi' ? 'điểm con' : language === 'ja' ? '子停留所' : 'child stops'}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} className="text-teal-500" />
                      {copyModal.stop.name}
                    </span>
                  )}
                </p>
              </div>

              {/* Mode selector */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  {language === 'vi' ? 'Chọn cách sao chép' : language === 'ja' ? 'コピー方法を選択' : 'Choose copy method'}
                </label>

                {isTerminal ? (
                  <div className="space-y-2">
                    <label
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                        copyModal.mode === 'new'
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <input
                        type="radio"
                        name="copyMode"
                        value="new"
                        checked={copyModal.mode === 'new'}
                        onChange={() => setCopyModal(m => m ? { ...m, mode: 'new' } : m)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{t.copy_stops_to_new_terminal}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {language === 'vi'
                            ? `Tạo một bến/ga mới với tên "${copyModal.stop.name} (bản sao)" và sao chép ${children.length} điểm dừng con vào đó`
                            : language === 'ja'
                              ? `「${copyModal.stop.name}（コピー）」という新しいターミナルを作成し、${children.length}件の子停留所をコピーします`
                              : `Create a new terminal named "${copyModal.stop.name} (copy)" and copy ${children.length} child stop(s) into it`}
                        </p>
                      </div>
                    </label>

                    {hasOtherTerminals && (
                      <label
                        className={cn(
                          'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                          copyModal.mode === 'existing'
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-100 hover:border-gray-200'
                        )}
                      >
                        <input
                          type="radio"
                          name="copyMode"
                          value="existing"
                          checked={copyModal.mode === 'existing'}
                          onChange={() => setCopyModal(m => m ? { ...m, mode: 'existing', targetTerminalId: firstOtherTerminalId } : m)}
                          className="mt-0.5 accent-teal-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{t.copy_stops_to_existing_terminal}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {language === 'vi'
                              ? `Sao chép ${children.length} điểm dừng con vào một bến/ga hiện có`
                              : language === 'ja'
                                ? `${children.length}件の子停留所を既存のターミナルにコピーします`
                                : `Copy ${children.length} child stop(s) to an existing terminal`}
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                        copyModal.mode === 'new'
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <input
                        type="radio"
                        name="copyMode"
                        value="new"
                        checked={copyModal.mode === 'new'}
                        onChange={() => setCopyModal(m => m ? { ...m, mode: 'new' } : m)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{t.copy_stop_to_new_terminal}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {language === 'vi'
                            ? 'Tạo bản sao của điểm dừng này (giữ nguyên bến/ga cha hiện tại nếu có)'
                            : language === 'ja'
                              ? 'この停留所のコピーを作成します（現在の親ターミナルを保持します）'
                              : 'Create a copy of this stop (keeping its current parent terminal if any)'}
                        </p>
                      </div>
                    </label>

                    {hasOtherTerminals && (
                      <label
                        className={cn(
                          'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                          copyModal.mode === 'existing'
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-100 hover:border-gray-200'
                        )}
                      >
                        <input
                          type="radio"
                          name="copyMode"
                          value="existing"
                          checked={copyModal.mode === 'existing'}
                          onChange={() => setCopyModal(m => m ? { ...m, mode: 'existing', targetTerminalId: firstOtherTerminalId } : m)}
                          className="mt-0.5 accent-teal-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{t.copy_stop_to_existing_terminal}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {language === 'vi'
                              ? 'Sao chép điểm dừng này và gắn vào một bến/ga khác'
                              : language === 'ja'
                                ? 'この停留所をコピーして別のターミナルに追加します'
                                : 'Copy this stop and assign it to a different terminal'}
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Target terminal selector (visible when mode='existing') */}
              {copyModal.mode === 'existing' && hasOtherTerminals && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    {t.copy_stop_select_terminal}
                  </label>
                  <select
                    value={copyModal.targetTerminalId}
                    onChange={e => setCopyModal(m => m ? { ...m, targetTerminalId: e.target.value } : m)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-daiichi-red/10 focus:outline-none text-sm"
                  >
                    {otherTerminals.map(ts => (
                      <option key={ts.id} value={ts.id}>{ts.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCopyModal(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-all"
                >
                  {language === 'vi' ? 'Hủy' : language === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmCopy}
                  disabled={copyModal.mode === 'existing' && !copyModal.targetTerminalId}
                  className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/20 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  {t.copy_stop_confirm}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

