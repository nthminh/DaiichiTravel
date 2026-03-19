import { useState } from 'react';
import { Bus, Search, X, Filter, Edit3, Trash2, Copy } from 'lucide-react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language } from '../constants/translations';
import { Vehicle as VehicleBase } from '../types';

type Vehicle = VehicleBase & { id: string };
import { transportService } from '../services/transportService';
import { ResizableTh } from '../components/ResizableTh';
import { VehicleSeatDiagram, SerializedSeat } from '../components/VehicleSeatDiagram';
import { NotePopover } from '../components/NotePopover';

interface VehiclesPageProps {
  vehicles: Vehicle[];
  language: Language;
  uniqueVehicleTypes: string[];
}

export function VehiclesPage({ vehicles, language, uniqueVehicleTypes }: VehiclesPageProps) {
  const t = TRANSLATIONS[language];

  // Search / filter state
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleFilters, setShowVehicleFilters] = useState(false);
  const [vehicleFilterType, setVehicleFilterType] = useState('');
  const [vehicleFilterStatus, setVehicleFilterStatus] = useState('ALL');

  // Default/blank vehicle form
  const DEFAULT_VEHICLE_FORM = { licensePlate: '', type: 'Ghế ngồi', seats: 16, registrationExpiry: '', status: 'ACTIVE', seatType: 'assigned' as 'assigned' | 'free' };

  // CRUD modal state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isCopyingVehicle, setIsCopyingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(DEFAULT_VEHICLE_FORM);

  // Seat diagram state
  const [diagramVehicle, setDiagramVehicle] = useState<Vehicle | null>(null);

  // Column widths
  const [vehicleColWidths, setVehicleColWidths] = useState({
    stt: 80,
    licensePlate: 150,
    type: 150,
    seats: 100,
    expiry: 170,
    options: 160,
  });

  // Handlers
  const handleSaveVehicle = async () => {
    try {
      if (editingVehicle) {
        await transportService.updateVehicle(editingVehicle.id, vehicleForm as Record<string, unknown>);
      } else {
        await transportService.addVehicle(vehicleForm as Record<string, unknown>);
      }
      setShowAddVehicle(false);
      setEditingVehicle(null);
      setIsCopyingVehicle(false);
      setVehicleForm(DEFAULT_VEHICLE_FORM);
    } catch (err) {
      console.error('Failed to save vehicle:', err);
    }
  };

  const handleStartEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsCopyingVehicle(false);
    setVehicleForm({ licensePlate: vehicle.licensePlate, type: vehicle.type, seats: vehicle.seats, registrationExpiry: vehicle.registrationExpiry, status: vehicle.status || 'ACTIVE', seatType: vehicle.seatType || 'assigned' });
    setShowAddVehicle(true);
  };

  const handleCopyVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(null);
    setIsCopyingVehicle(true);
    setVehicleForm({ licensePlate: '', type: vehicle.type, seats: vehicle.seats, registrationExpiry: vehicle.registrationExpiry, status: vehicle.status || 'ACTIVE', seatType: vehicle.seatType || 'assigned' });
    setShowAddVehicle(true);
  };

  const handleSaveVehicleLayout = async (seats: SerializedSeat[]) => {
    if (!diagramVehicle) return;
    try {
      await transportService.updateVehicle(diagramVehicle.id, { layout: seats } as Record<string, unknown>);
      setDiagramVehicle(null);
    } catch (err) {
      console.error('Failed to save vehicle layout:', err);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!window.confirm(language === 'vi' ? 'Bạn có chắc muốn xóa phương tiện này?' : 'Delete this vehicle?')) return;
    try {
      await transportService.deleteVehicle(vehicleId);
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  };

  const handleSaveVehicleNote = async (vehicleId: string, note: string) => {
    try {
      await transportService.updateVehicle(vehicleId, { note } as Record<string, unknown>);
    } catch (err) {
      console.error('Failed to save vehicle note:', err);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    if (vehicleFilterType && (v.type || '') !== vehicleFilterType) return false;
    if (vehicleFilterStatus !== 'ALL' && (v.status || 'ACTIVE') !== vehicleFilterStatus) return false;
    if (!vehicleSearch) return true;
    const q = vehicleSearch.toLowerCase();
    return (
      (v.licensePlate || '').toLowerCase().includes(q) ||
      (v.type || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div><h2 className="text-2xl font-bold">{t.vehicle_management}</h2><p className="text-sm text-gray-500">{t.vehicle_list}</p></div>
        <div className="flex gap-3 flex-wrap">
          {vehicles.length === 0 && (
            <button
              onClick={async () => {
                try {
                  const added = await transportService.seedVehicles();
                  if (added === 0) alert(language === 'vi' ? 'Tất cả xe đã tồn tại.' : 'All vehicles already exist.');
                  else alert(language === 'vi' ? `Đã thêm ${added} xe.` : `Added ${added} vehicles.`);
                } catch (e) {
                  console.error(e);
                  alert(language === 'vi' ? 'Lỗi khi thêm dữ liệu xe.' : 'Error seeding vehicles.');
                }
              }}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 text-sm"
            >
              {language === 'vi' ? '📋 Nạp danh sách xe' : '📋 Seed Vehicles'}
            </button>
          )}
          <button onClick={() => { setShowAddVehicle(true); setEditingVehicle(null); setIsCopyingVehicle(false); setVehicleForm(DEFAULT_VEHICLE_FORM); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_vehicle}</button>
        </div>
      </div>

      {/* Add/Edit Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {editingVehicle
                  ? (language === 'vi' ? 'Chỉnh sửa phương tiện' : language === 'en' ? 'Edit Vehicle' : '車両を編集')
                  : isCopyingVehicle
                    ? `📋 ${t.copy_vehicle_title}`
                    : (language === 'vi' ? 'Thêm phương tiện mới' : language === 'en' ? 'Add New Vehicle' : '新しい車両を追加')}
              </h3>
              <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); setIsCopyingVehicle(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate}</label><input type="text" value={vehicleForm.licensePlate} onChange={e => setVehicleForm(p => ({ ...p, licensePlate: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder="29B-123.45" /></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label><input type="number" min="1" value={vehicleForm.seats} onChange={e => setVehicleForm(p => ({ ...p, seats: parseInt(e.target.value) || 6 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.vehicle_type}</label>
                <select value={vehicleForm.type} onChange={e => setVehicleForm(p => ({ ...p, type: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="Ghế ngồi">Ghế ngồi</option>
                  <option value="Ghế ngồi limousine">Ghế ngồi limousine</option>
                  <option value="Giường nằm">Giường nằm</option>
                  <option value="Phòng VIP (cabin)">Phòng VIP (cabin)</option>
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.registration_expiry}</label><input type="date" value={vehicleForm.registrationExpiry} onChange={e => setVehicleForm(p => ({ ...p, registrationExpiry: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Loại ghế' : language === 'en' ? 'Seat Type' : '座席タイプ'}</label>
                <select value={vehicleForm.seatType} onChange={e => setVehicleForm(p => ({ ...p, seatType: e.target.value as 'assigned' | 'free' }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
                  <option value="assigned">{language === 'vi' ? 'Ghế chỉ định' : language === 'en' ? 'Assigned Seats' : '指定席'}</option>
                  <option value="free">{language === 'vi' ? 'Ghế tự do' : language === 'en' ? 'Free Seating' : '自由席'}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-2">
              <button onClick={() => { setShowAddVehicle(false); setEditingVehicle(null); setIsCopyingVehicle(false); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
              <button onClick={handleSaveVehicle} disabled={!vehicleForm.licensePlate} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingVehicle ? t.save : isCopyingVehicle ? t.create_copy : (language === 'vi' ? 'Thêm xe' : language === 'en' ? 'Add Vehicle' : '車両を追加')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle seat diagram modal */}
      {diagramVehicle && (
        <VehicleSeatDiagram
          licensePlate={diagramVehicle.licensePlate}
          vehicleType={diagramVehicle.type}
          seatCount={diagramVehicle.seats}
          savedSeats={(diagramVehicle.layout as any) || null}
          editable={true}
          onSave={handleSaveVehicleLayout}
          onClose={() => setDiagramVehicle(null)}
          language={language}
        />
      )}

      {/* Search bar + Advanced Filter Toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={vehicleSearch}
              onChange={e => setVehicleSearch(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm kiếm theo biển số, loại xe...' : 'Search by plate, type...'}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
            />
            {vehicleSearch && (
              <button onClick={() => setVehicleSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowVehicleFilters(p => !p)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
              showVehicleFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Filter size={15} />
            {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
            {(vehicleFilterType || vehicleFilterStatus !== 'ALL') && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">
                {[vehicleFilterType, vehicleFilterStatus !== 'ALL'].filter(Boolean).length}
              </span>
            )}
          </button>
          {(vehicleSearch || vehicleFilterType || vehicleFilterStatus !== 'ALL') && (
            <button
              onClick={() => { setVehicleSearch(''); setVehicleFilterType(''); setVehicleFilterStatus('ALL'); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
            >
              <X size={14} />
              {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
            </button>
          )}
        </div>
        {showVehicleFilters && (
          <div className="flex gap-4 flex-wrap pt-1 border-t border-gray-100">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.vehicle_type}</label>
              <div className="flex gap-2 flex-wrap">
                {(['', ...uniqueVehicleTypes] as string[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setVehicleFilterType(type)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                      vehicleFilterType === type
                        ? 'bg-daiichi-red text-white ring-2 ring-daiichi-red'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {type === '' ? (language === 'vi' ? 'Tất cả' : 'All') : type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.status}</label>
              <div className="flex gap-2">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setVehicleFilterStatus(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                      vehicleFilterStatus === s
                        ? s === 'ACTIVE' ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                          : s === 'INACTIVE' ? 'bg-gray-200 text-gray-700 ring-2 ring-gray-400'
                          : 'bg-daiichi-red/10 text-daiichi-red ring-2 ring-daiichi-red/30'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                  >
                    {s === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All')
                      : s === 'ACTIVE' ? (language === 'vi' ? 'Hoạt động' : 'Active')
                      : (language === 'vi' ? 'Ngừng' : 'Inactive')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <ResizableTh width={vehicleColWidths.stt} onResize={(w) => setVehicleColWidths(p => ({ ...p, stt: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">STT</ResizableTh>
                <ResizableTh width={vehicleColWidths.licensePlate} onResize={(w) => setVehicleColWidths(p => ({ ...p, licensePlate: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.license_plate}</ResizableTh>
                <ResizableTh width={vehicleColWidths.type} onResize={(w) => setVehicleColWidths(p => ({ ...p, type: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.vehicle_type}</ResizableTh>
                <ResizableTh width={vehicleColWidths.seats} onResize={(w) => setVehicleColWidths(p => ({ ...p, seats: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.seats}</ResizableTh>
                <ResizableTh width={vehicleColWidths.expiry} onResize={(w) => setVehicleColWidths(p => ({ ...p, expiry: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.registration_expiry}</ResizableTh>
                <ResizableTh width={vehicleColWidths.options} onResize={(w) => setVehicleColWidths(p => ({ ...p, options: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVehicles.map((v, idx) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-6 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-6 py-6 font-bold text-gray-800">{v.licensePlate}</td>
                  <td className="px-6 py-6 text-sm">{v.type}{v.seatType === 'free' && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-600 uppercase">{language === 'vi' ? 'Tự do' : 'Free'}</span>}</td>
                  <td className="px-6 py-6 text-sm">{v.seats}</td>
                  <td className="px-6 py-6 text-sm">{v.registrationExpiry}</td>
                  <td className="px-6 py-6">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDiagramVehicle(v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                        title={language === 'vi' ? 'Xem / sửa sơ đồ xe' : 'View / edit seat diagram'}
                      >
                        <Bus size={13} />
                        {language === 'vi' ? 'Sơ đồ' : 'Diagram'}
                      </button>
                      <button onClick={() => handleStartEditVehicle(v)} className="text-gray-600 hover:text-daiichi-red p-1.5"><Edit3 size={16} /></button>
                      <button onClick={() => handleCopyVehicle(v)} title={t.copy_vehicle} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1.5 rounded"><Copy size={16} /></button>
                      <button onClick={() => handleDeleteVehicle(v.id)} className="text-gray-600 hover:text-red-600 p-1.5"><Trash2 size={16} /></button>
                      <NotePopover note={v.note} onSave={(note) => handleSaveVehicleNote(v.id, note)} language={language} />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Không tìm thấy phương tiện nào.' : 'No vehicles found.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
