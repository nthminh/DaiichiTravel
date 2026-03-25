import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { getLocalDateString } from '../lib/utils';
import { TRANSLATIONS, Language, TripStatus, SeatStatus } from '../constants/translations';
import { Trip, Route, Vehicle, PricePeriod } from '../types';
import { SearchableSelect } from './SearchableSelect';

type TranslationRecord = typeof TRANSLATIONS['vi'];

export interface TripFormModalProps {
  showAddTrip: boolean;
  setShowAddTrip: (v: boolean) => void;
  editingTrip: Trip | null;
  setEditingTrip: (v: Trip | null) => void;
  isCopyingTrip: boolean;
  setIsCopyingTrip: (v: boolean) => void;
  tripForm: {
    time: string;
    date: string;
    route: string;
    licensePlate: string;
    driverName: string;
    price: number;
    agentPrice: number;
    discountPercent: number;
    seatCount: number;
    status: TripStatus;
  };
  setTripForm: React.Dispatch<React.SetStateAction<{
    time: string;
    date: string;
    route: string;
    licensePlate: string;
    driverName: string;
    price: number;
    agentPrice: number;
    discountPercent: number;
    seatCount: number;
    status: TripStatus;
  }>>;
  isSavingTrip: boolean;
  tripSaveError: string | null;
  setTripSaveError: (v: string | null) => void;
  handleSaveTrip: () => void;
  handleTripVehicleSelect: (licensePlate: string) => void;
  routes: Route[];
  vehicles: Vehicle[];
  activeEmployeeNames: string[];
  language: Language;
  t: TranslationRecord;
  getRouteActivePeriod: (route: Route, date: string) => PricePeriod | null;
  isRouteValidForDate: (route: Route, date: string) => boolean;
  formatRouteOption: (route: Route, period: PricePeriod | null, lang: Language) => string;
}

export function TripFormModal({
  showAddTrip,
  setShowAddTrip,
  editingTrip,
  setEditingTrip,
  isCopyingTrip,
  setIsCopyingTrip,
  tripForm,
  setTripForm,
  isSavingTrip,
  tripSaveError,
  setTripSaveError,
  handleSaveTrip,
  handleTripVehicleSelect,
  routes,
  vehicles,
  activeEmployeeNames,
  language,
  t,
  getRouteActivePeriod,
  isRouteValidForDate,
  formatRouteOption,
}: TripFormModalProps) {
  if (!showAddTrip) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">
            {editingTrip
              ? (language === 'vi' ? 'Chỉnh sửa chuyến' : 'Edit Trip')
              : isCopyingTrip
                ? `📋 ${t.copy_trip}`
                : (language === 'vi' ? 'Thêm chuyến mới' : 'Add New Trip')}
          </h3>
          <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); setIsCopyingTrip(false); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_date}</label><input type="date" value={tripForm.date} min={editingTrip ? undefined : getLocalDateString(0)} onChange={e => {
              const date = e.target.value;
              const selectedRoute = routes.find(r => r.name === tripForm.route);
              if (selectedRoute) {
                const period = getRouteActivePeriod(selectedRoute, date);
                const price = period ? period.price : selectedRoute.price;
                const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                setTripForm(p => ({ ...p, date, price, agentPrice }));
              } else {
                setTripForm(p => ({ ...p, date }));
              }
            }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_time}</label><input type="time" value={tripForm.time} onChange={e => setTripForm(p => ({ ...p, time: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={tripForm.price} onChange={e => setTripForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
            <div><label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label><input type="number" min="0" value={tripForm.agentPrice} onChange={e => setTripForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" /></div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-green-600 uppercase tracking-widest ml-1">
              🏷️ {language === 'vi' ? 'Giảm giá (%)' : language === 'ja' ? '割引 (%)' : 'Discount (%)'}
            </label>
            <p className="text-[10px] text-gray-400 mt-0.5 ml-1">
              {language === 'vi'
                ? 'Nhập % giảm giá để kích thích khách mua chuyến ít người đi (0 = không giảm)'
                : language === 'ja'
                  ? '空席が多い便の購入を促すために割引率を入力 (0 = 割引なし)'
                  : 'Set a % discount to incentivize bookings on under-filled trips (0 = no discount)'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min="0"
                max="100"
                value={tripForm.discountPercent}
                onChange={e => setTripForm(p => ({ ...p, discountPercent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                className="w-full px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              <span className="text-lg font-bold text-green-600 flex-shrink-0">%</span>
            </div>
            {tripForm.discountPercent > 0 && (
              <p className="text-[11px] font-semibold text-green-700 mt-1 ml-1">
                {language === 'vi'
                  ? `Giá sau giảm: ${Math.round(tripForm.price * (1 - tripForm.discountPercent / 100)).toLocaleString()}đ`
                  : language === 'ja'
                    ? `割引後の価格: ${Math.round(tripForm.price * (1 - tripForm.discountPercent / 100)).toLocaleString()}đ`
                    : `Discounted price: ${Math.round(tripForm.price * (1 - tripForm.discountPercent / 100)).toLocaleString()}đ`}
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label>
            {tripForm.date && (
              <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                {language === 'vi' ? '* Chỉ hiển thị tuyến có hiệu lực vào ngày đã chọn' : '* Only showing routes valid for selected date'}
              </p>
            )}
            <select value={tripForm.route} onChange={e => {
              const routeName = e.target.value;
              const selectedRoute = routes.find(r => r.name === routeName);
              if (selectedRoute) {
                const period = getRouteActivePeriod(selectedRoute, tripForm.date);
                const price = period ? period.price : selectedRoute.price;
                const agentPrice = period ? period.agentPrice : (selectedRoute.agentPrice || 0);
                setTripForm(p => ({ ...p, route: routeName, price, agentPrice }));
              } else {
                setTripForm(p => ({ ...p, route: routeName }));
              }
            }} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
              <option value="">{language === 'vi' ? '-- Chọn tuyến --' : '-- Select Route --'}</option>
              {routes.filter(r => isRouteValidForDate(r, tripForm.date)).map(r => {
                const period = getRouteActivePeriod(r, tripForm.date);
                return <option key={r.id} value={r.name}>{formatRouteOption(r, period, language)}</option>;
              })}
            </select>
          </div>
          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.license_plate} <span className="normal-case font-normal text-gray-400">({language === 'vi' ? 'tùy chọn' : 'optional'})</span></label>
            <select value={tripForm.licensePlate} onChange={e => handleTripVehicleSelect(e.target.value)} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
              <option value="">{language === 'vi' ? '-- Chọn xe (tùy chọn) --' : '-- Select Vehicle (optional) --'}</option>
              {vehicles.map(v => <option key={v.id} value={v.licensePlate}>{v.licensePlate} - {v.type} ({v.seats} {t.seats})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.driver}</label>
            <SearchableSelect
              options={activeEmployeeNames}
              value={tripForm.driverName}
              onChange={(val) => setTripForm(p => ({ ...p, driverName: val }))}
              placeholder={language === 'vi' ? 'Chọn hoặc nhập tên tài xế...' : 'Select or type driver name...'}
              className="mt-1"
            />
          </div>
          {(() => {
            const editBookedCount = editingTrip
              ? (editingTrip.seats || []).filter((s: any) => s.status !== SeatStatus.EMPTY).length
              : 0;
            const seatMin = editingTrip ? editBookedCount || 1 : 1;
            return (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.seats}</label>
                {editingTrip && (
                  <p className="text-[10px] text-blue-500 mt-0.5 ml-1">
                    {language === 'vi'
                      ? `* Đang có ${editBookedCount} ghế đã đặt, không thể giảm xuống dưới số này`
                      : `* ${editBookedCount} seat(s) already booked – cannot reduce below this`}
                  </p>
                )}
                <input
                  type="number"
                  min={seatMin}
                  value={tripForm.seatCount}
                  onChange={e => setTripForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 11 }))}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                />
              </div>
            );
          })()}
          <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.status}</label>
            <select value={tripForm.status} onChange={e => setTripForm(p => ({ ...p, status: e.target.value as TripStatus }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none">
              <option value={TripStatus.WAITING}>{language === 'vi' ? 'Chờ khởi hành' : 'Waiting'}</option>
              <option value={TripStatus.RUNNING}>{language === 'vi' ? 'Đang chạy' : 'Running'}</option>
              <option value={TripStatus.COMPLETED}>{language === 'vi' ? 'Hoàn thành' : 'Completed'}</option>
            </select>
          </div>
        </div>
        {tripSaveError && (
          <div className="mx-1 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            {tripSaveError}
          </div>
        )}
        <div className="flex justify-end gap-4 pt-2">
          <button onClick={() => { setShowAddTrip(false); setEditingTrip(null); setIsCopyingTrip(false); setTripSaveError(null); }} disabled={isSavingTrip} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50">{t.cancel}</button>
          <button onClick={handleSaveTrip} disabled={!tripForm.time || !tripForm.route || isSavingTrip} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50 flex items-center gap-2">
            {isSavingTrip && <Loader2 size={16} className="animate-spin" />}
            {editingTrip ? t.save : isCopyingTrip ? t.create_copy : (language === 'vi' ? 'Thêm chuyến' : 'Add Trip')}
          </button>
        </div>
      </div>
    </div>
  );
}
