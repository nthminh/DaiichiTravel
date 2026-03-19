import React from 'react';
import { X, Loader2, Edit3, Trash2, Search, Filter, Calendar, FileText, Copy } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Language } from '../constants/translations';
import { TRANSLATIONS } from '../constants/translations';
import { Route, Stop, PricePeriod, RouteSurcharge, RouteStop } from '../types';
import { ResizableTh } from '../components/ResizableTh';
import { NotePopover } from '../components/NotePopover';
import { SearchableSelect } from '../components/SearchableSelect';
import { exportRouteToPDF } from '../utils/exportUtils';
import { DEFAULT_ROUTE_FORM } from '../hooks/useRoutes';

const STOP_ID_DEPARTURE = '__departure__';
const STOP_ID_ARRIVAL = '__arrival__';

type TranslationRecord = typeof TRANSLATIONS['vi'];

type RouteFareEntry = {
  fromStopId: string;
  toStopId: string;
  fromName: string;
  toName: string;
  price: number;
  agentPrice: number;
  startDate: string;
  endDate: string;
};

interface RouteManagementPageProps {
  routes: Route[];
  stops: Stop[];
  terminalStops: Stop[];
  language: Language;
  t: TranslationRecord;
  routeSearch: string;
  setRouteSearch: (v: string) => void;
  showRouteFilters: boolean;
  setShowRouteFilters: React.Dispatch<React.SetStateAction<boolean>>;
  routeFilterDeparture: string;
  setRouteFilterDeparture: (v: string) => void;
  routeFilterArrival: string;
  setRouteFilterArrival: (v: string) => void;
  routeColWidths: { stt: number; name: number; departure: number; arrival: number; price: number; agentPrice: number; options: number };
  setRouteColWidths: React.Dispatch<React.SetStateAction<{ stt: number; name: number; departure: number; arrival: number; price: number; agentPrice: number; options: number }>>;
  showAddRoute: boolean;
  setShowAddRoute: (v: boolean) => void;
  editingRoute: Route | null;
  setEditingRoute: (v: Route | null) => void;
  isCopyingRoute: boolean;
  setIsCopyingRoute: (v: boolean) => void;
  routeForm: typeof DEFAULT_ROUTE_FORM;
  setRouteForm: React.Dispatch<React.SetStateAction<typeof DEFAULT_ROUTE_FORM>>;
  routePricePeriods: PricePeriod[];
  setRoutePricePeriods: React.Dispatch<React.SetStateAction<PricePeriod[]>>;
  showAddPricePeriod: boolean;
  setShowAddPricePeriod: (v: boolean) => void;
  pricePeriodForm: { name: string; price: number; agentPrice: number; startDate: string; endDate: string };
  setPricePeriodForm: React.Dispatch<React.SetStateAction<{ name: string; price: number; agentPrice: number; startDate: string; endDate: string }>>;
  editingPricePeriodId: string | null;
  setEditingPricePeriodId: (v: string | null) => void;
  routeSurcharges: RouteSurcharge[];
  setRouteSurcharges: React.Dispatch<React.SetStateAction<RouteSurcharge[]>>;
  showAddRouteSurcharge: boolean;
  setShowAddRouteSurcharge: (v: boolean) => void;
  routeSurchargeForm: Omit<RouteSurcharge, 'id' | 'amount'> & { amount: number | '' };
  setRouteSurchargeForm: React.Dispatch<React.SetStateAction<Omit<RouteSurcharge, 'id' | 'amount'> & { amount: number | '' }>>;
  editingRouteSurchargeId: string | null;
  setEditingRouteSurchargeId: (v: string | null) => void;
  routeFormStops: RouteStop[];
  setRouteFormStops: React.Dispatch<React.SetStateAction<RouteStop[]>>;
  allRouteStops: RouteStop[];
  showAddRouteStop: boolean;
  setShowAddRouteStop: (v: boolean) => void;
  editingRouteStop: RouteStop | null;
  setEditingRouteStop: (v: RouteStop | null) => void;
  routeStopForm: { stopId: string; stopName: string; order: number };
  setRouteStopForm: React.Dispatch<React.SetStateAction<{ stopId: string; stopName: string; order: number }>>;
  routeFormStopsHistory: RouteStop[][];
  setRouteFormStopsHistory: React.Dispatch<React.SetStateAction<RouteStop[][]>>;
  routeFormFaresHistory: RouteFareEntry[][];
  setRouteFormFaresHistory: React.Dispatch<React.SetStateAction<RouteFareEntry[][]>>;
  routeFormFares: RouteFareEntry[];
  setRouteFormFares: React.Dispatch<React.SetStateAction<RouteFareEntry[]>>;
  showAddRouteFare: boolean;
  setShowAddRouteFare: (v: boolean) => void;
  editingRouteFareIdx: number | null;
  setEditingRouteFareIdx: (v: number | null) => void;
  routeFareForm: { fromStopId: string; toStopId: string; price: number; agentPrice: number; startDate: string; endDate: string };
  setRouteFareForm: React.Dispatch<React.SetStateAction<{ fromStopId: string; toStopId: string; price: number; agentPrice: number; startDate: string; endDate: string }>>;
  routeImageUploading: boolean;
  setRouteModalEditingId: (v: string | null) => void;
  handleSaveRoute: () => Promise<void>;
  handleRouteImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteRoute: (id: string) => Promise<void>;
  handleStartEditRoute: (route: Route) => void;
  handleCopyRoute: (route: Route) => void;
  handleSaveRouteNote: (id: string, note: string) => void;
}

export function RouteManagementPage({
  routes,
  stops,
  terminalStops,
  language,
  t,
  routeSearch,
  setRouteSearch,
  showRouteFilters,
  setShowRouteFilters,
  routeFilterDeparture,
  setRouteFilterDeparture,
  routeFilterArrival,
  setRouteFilterArrival,
  routeColWidths,
  setRouteColWidths,
  showAddRoute,
  setShowAddRoute,
  editingRoute,
  setEditingRoute,
  isCopyingRoute,
  setIsCopyingRoute,
  routeForm,
  setRouteForm,
  routePricePeriods,
  setRoutePricePeriods,
  showAddPricePeriod,
  setShowAddPricePeriod,
  pricePeriodForm,
  setPricePeriodForm,
  editingPricePeriodId,
  setEditingPricePeriodId,
  routeSurcharges,
  setRouteSurcharges,
  showAddRouteSurcharge,
  setShowAddRouteSurcharge,
  routeSurchargeForm,
  setRouteSurchargeForm,
  editingRouteSurchargeId,
  setEditingRouteSurchargeId,
  routeFormStops,
  setRouteFormStops,
  allRouteStops,
  showAddRouteStop,
  setShowAddRouteStop,
  editingRouteStop,
  setEditingRouteStop,
  routeStopForm,
  setRouteStopForm,
  routeFormStopsHistory,
  setRouteFormStopsHistory,
  routeFormFaresHistory,
  setRouteFormFaresHistory,
  routeFormFares,
  setRouteFormFares,
  showAddRouteFare,
  setShowAddRouteFare,
  editingRouteFareIdx,
  setEditingRouteFareIdx,
  routeFareForm,
  setRouteFareForm,
  routeImageUploading,
  setRouteModalEditingId,
  handleSaveRoute,
  handleRouteImageUpload,
  handleDeleteRoute,
  handleStartEditRoute,
  handleCopyRoute,
  handleSaveRouteNote,
}: RouteManagementPageProps) {
        const filteredRoutes = routes.filter(route => {
          if (routeFilterDeparture && !(route.departurePoint || '').toLowerCase().includes(routeFilterDeparture.toLowerCase())) return false;
          if (routeFilterArrival && !(route.arrivalPoint || '').toLowerCase().includes(routeFilterArrival.toLowerCase())) return false;
          if (!routeSearch) return true;
          const q = routeSearch.toLowerCase();
          return (
            (route.name || '').toLowerCase().includes(q) ||
            (route.departurePoint || '').toLowerCase().includes(q) ||
            (route.arrivalPoint || '').toLowerCase().includes(q)
          );
        });
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div><h2 className="text-2xl font-bold">{t.route_management}</h2><p className="text-sm text-gray-500">{t.route_list}</p></div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAddRoute(true); setEditingRoute(null); setIsCopyingRoute(false); setRouteForm({ stt: routes.length + 1, name: '', departurePoint: '', arrivalPoint: '', price: 0, agentPrice: 0, details: '', imageUrl: '', images: [], vehicleImageUrl: '', disablePickupAddress: false, disablePickupAddressFrom: '', disablePickupAddressTo: '', disableDropoffAddress: false, disableDropoffAddressFrom: '', disableDropoffAddressTo: '' }); setRoutePricePeriods([]); setShowAddPricePeriod(false); setEditingPricePeriodId(null); setRouteSurcharges([]); setShowAddRouteSurcharge(false); setEditingRouteSurchargeId(null); setRouteFormStops([]); setShowAddRouteStop(false); setRouteFormFares([]); setShowAddRouteFare(false); setEditingRouteFareIdx(null); }} className="bg-daiichi-red text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-daiichi-red/20">+ {t.add_route}</button>
              </div>
            </div>

            {/* Add/Edit Route Modal */}
            {showAddRoute && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[32px] p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">
                      {editingRoute
                        ? (language === 'vi' ? 'Chỉnh sửa tuyến' : 'Edit Route')
                        : isCopyingRoute
                          ? `📋 ${t.copy_route_title}`
                          : (language === 'vi' ? 'Thêm tuyến mới' : 'Add New Route')}
                    </h3>
                    <button onClick={() => { setShowAddRoute(false); setEditingRoute(null); setIsCopyingRoute(false); setRouteModalEditingId(null); }} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">STT</label><input type="number" value={routeForm.stt} onChange={e => setRouteForm(p => ({ ...p, stt: parseInt(e.target.value) || 1 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_name}</label><input type="text" value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" placeholder={language === 'vi' ? 'VD: Hà Nội - Cát Bà' : 'e.g. Hanoi - Cat Ba'} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.ticket_price} (đ)</label><input type="number" min="0" value={routeForm.price} onChange={e => setRouteForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.agent_price} (đ)</label>
                        <input type="number" min="0" value={routeForm.agentPrice} onChange={e => setRouteForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        <p className="text-[10px] text-orange-500 mt-1 ml-1">{language === 'vi' ? '* Chỉ hiển thị cho đại lý' : '* Visible to agents only'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_point}</label>
                      <select
                        value={routeForm.departurePoint}
                        onChange={e => setRouteForm(p => ({ ...p, departurePoint: e.target.value }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      >
                        <option value="">{language === 'vi' ? '-- Chọn bến đi --' : '-- Select departure terminal --'}</option>
                        {terminalStops.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.arrival_point}</label>
                      <select
                        value={routeForm.arrivalPoint}
                        onChange={e => setRouteForm(p => ({ ...p, arrivalPoint: e.target.value }))}
                        className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                      >
                        <option value="">{language === 'vi' ? '-- Chọn bến đến --' : '-- Select arrival terminal --'}</option>
                        {terminalStops.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.route_details}</label>
                      <textarea value={routeForm.details} onChange={e => setRouteForm(p => ({ ...p, details: e.target.value }))} rows={4} placeholder={t.route_details_placeholder} className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 resize-none" />
                    </div>

                    {/* Route images (location photos) */}
                    <div className="space-y-3">
                      {/* Destination images – multiple allowed */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ảnh điểm đến (có thể tải nhiều ảnh)' : 'Destination Photos (multiple allowed)'}</label>
                        {/* Uploaded images gallery */}
                        {(routeForm.images && routeForm.images.length > 0) && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {routeForm.images.map((url, idx) => (
                              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-100">
                                <img src={url} alt={`Route ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button
                                  onClick={() => {
                                    const newImages = routeForm.images.filter((_, i) => i !== idx);
                                    setRouteForm(p => ({ ...p, images: newImages, imageUrl: newImages[0] || '' }));
                                  }}
                                  className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-lg"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Upload area */}
                        <div className="relative mt-1 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1">
                          {routeImageUploading ? (
                            <Loader2 className="animate-spin text-daiichi-red" size={24} />
                          ) : (
                            <>
                              <span className="text-xs text-gray-400">{language === 'vi' ? 'Chọn ảnh (nhiều ảnh)' : 'Select photos (multiple)'}</span>
                              <input type="file" accept="image/*" multiple onChange={handleRouteImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Price Periods (Seasonal Pricing) */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{t.price_periods}</p>
                          <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Giá thay đổi theo mùa / dịp lễ tết' : 'Prices that vary by season or holiday'}</p>
                        </div>
                        {!showAddPricePeriod && (
                          <button onClick={() => { setShowAddPricePeriod(true); setPricePeriodForm({ name: '', price: routeForm.price, agentPrice: routeForm.agentPrice, startDate: '', endDate: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">
                            + {t.add_price_period}
                          </button>
                        )}
                      </div>

                      {routePricePeriods.length === 0 && !showAddPricePeriod && (
                        <p className="text-xs text-gray-400 text-center py-2">{t.no_price_periods}</p>
                      )}

                      {routePricePeriods.map((period) => (
                        <div key={period.id} className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{period.name || (language === 'vi' ? 'Kỳ giá' : 'Period')}</p>
                            <p className="text-xs text-gray-500">{period.startDate} → {period.endDate}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-xs font-bold text-daiichi-red">{period.price.toLocaleString()}đ</span>
                              <span className="text-xs font-bold text-orange-600">{language === 'vi' ? 'ĐL' : 'Agt'}: {period.agentPrice.toLocaleString()}đ</span>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingPricePeriodId(period.id); setPricePeriodForm({ name: period.name || '', price: period.price, agentPrice: period.agentPrice, startDate: period.startDate, endDate: period.endDate }); setShowAddPricePeriod(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg flex-shrink-0">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setRoutePricePeriods(prev => prev.filter(p => p.id !== period.id))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {showAddPricePeriod && (
                        <div className="border border-dashed border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50/50">
                          <p className="text-xs font-bold text-blue-700">{editingPricePeriodId ? (language === 'vi' ? 'Hiệu chỉnh kỳ giá' : language === 'ja' ? '価格期間を編集' : 'Edit price period') : (language === 'vi' ? 'Thêm kỳ giá mới' : language === 'ja' ? '価格期間を追加' : 'Add price period')}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_name}</label>
                              <input type="text" value={pricePeriodForm.name} onChange={e => setPricePeriodForm(p => ({ ...p, name: e.target.value }))} placeholder={language === 'vi' ? 'VD: Tết 2026, Hè 2025...' : 'e.g. Tet 2026, Summer 2025...'} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_start}</label>
                              <input type="date" value={pricePeriodForm.startDate} onChange={e => setPricePeriodForm(p => ({ ...p, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_end}</label>
                              <input type="date" value={pricePeriodForm.endDate} onChange={e => setPricePeriodForm(p => ({ ...p, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.price_period_retail} (đ)</label>
                              <input type="number" min="0" value={pricePeriodForm.price} onChange={e => setPricePeriodForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t.price_period_agent} (đ)</label>
                              <input type="number" min="0" value={pricePeriodForm.agentPrice} onChange={e => setPricePeriodForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddPricePeriod(false); setEditingPricePeriodId(null); setPricePeriodForm({ name: '', price: 0, agentPrice: 0, startDate: '', endDate: '' }); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                            <button
                              disabled={!pricePeriodForm.startDate || !pricePeriodForm.endDate}
                              onClick={() => {
                                if (editingPricePeriodId) {
                                  setRoutePricePeriods(prev => prev.map(p => p.id === editingPricePeriodId ? { ...p, name: pricePeriodForm.name, price: pricePeriodForm.price, agentPrice: pricePeriodForm.agentPrice, startDate: pricePeriodForm.startDate, endDate: pricePeriodForm.endDate } : p));
                                  setEditingPricePeriodId(null);
                                } else {
                                  const newPeriod: PricePeriod = {
                                    id: crypto.randomUUID(),
                                    name: pricePeriodForm.name,
                                    price: pricePeriodForm.price,
                                    agentPrice: pricePeriodForm.agentPrice,
                                    startDate: pricePeriodForm.startDate,
                                    endDate: pricePeriodForm.endDate,
                                  };
                                  setRoutePricePeriods(prev => [...prev, newPeriod]);
                                }
                                setShowAddPricePeriod(false);
                                setPricePeriodForm({ name: '', price: 0, agentPrice: 0, startDate: '', endDate: '' });
                              }}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Route Surcharges */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Phụ thu tuyến đường' : language === 'ja' ? 'ルート追加料金' : 'Route Surcharges'}</p>
                          <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Phụ thu xăng dầu, lễ tết, và các khoản phụ thu khác' : language === 'ja' ? '燃料、祝日、その他の追加料金' : 'Fuel, holiday, and other surcharges'}</p>
                        </div>
                        {!showAddRouteSurcharge && (
                          <button onClick={() => { setShowAddRouteSurcharge(true); setRouteSurchargeForm({ name: '', type: 'FUEL', amount: '', isActive: true }); }} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100">
                            + {language === 'vi' ? 'Thêm phụ thu' : language === 'ja' ? '追加料金を追加' : 'Add Surcharge'}
                          </button>
                        )}
                      </div>

                      {routeSurcharges.length === 0 && !showAddRouteSurcharge && (
                        <p className="text-xs text-gray-400 text-center py-2">{language === 'vi' ? 'Chưa có phụ thu nào' : language === 'ja' ? '追加料金なし' : 'No surcharges defined'}</p>
                      )}

                      {routeSurcharges.map((sc) => (
                        <div key={sc.id} className={`flex items-center gap-3 rounded-xl p-3 ${sc.isActive ? 'bg-amber-50' : 'bg-gray-50 opacity-60'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-gray-800 truncate">{sc.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.type === 'FUEL' ? 'bg-orange-100 text-orange-600' : sc.type === 'HOLIDAY' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                {sc.type === 'FUEL' ? (language === 'vi' ? 'Xăng dầu' : language === 'ja' ? '燃料' : 'Fuel') : sc.type === 'HOLIDAY' ? (language === 'vi' ? 'Lễ tết' : language === 'ja' ? '祝日' : 'Holiday') : (language === 'vi' ? 'Khác' : language === 'ja' ? 'その他' : 'Other')}
                              </span>
                              {!sc.isActive && <span className="text-[10px] text-gray-400 font-bold">{language === 'vi' ? '(Tạm dừng)' : '(Paused)'}</span>}
                            </div>
                            {sc.startDate && sc.endDate && <p className="text-xs text-gray-500">{sc.startDate} → {sc.endDate}</p>}
                            <p className="text-xs font-bold text-amber-600">+{sc.amount.toLocaleString()}đ/{language === 'vi' ? 'người' : language === 'ja' ? '人' : 'person'}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setRouteSurcharges(prev => prev.map(s => s.id === sc.id ? { ...s, isActive: !s.isActive } : s))} className={`p-1.5 rounded-lg text-xs font-bold transition-all ${sc.isActive ? 'text-amber-600 hover:bg-amber-100' : 'text-gray-400 hover:bg-gray-100'}`} title={sc.isActive ? (language === 'vi' ? 'Tạm dừng' : 'Pause') : (language === 'vi' ? 'Kích hoạt' : 'Activate')}>
                              {sc.isActive ? '✓' : '○'}
                            </button>
                            <button onClick={() => { setEditingRouteSurchargeId(sc.id); setRouteSurchargeForm({ name: sc.name, type: sc.type, amount: sc.amount, isActive: sc.isActive, startDate: sc.startDate, endDate: sc.endDate }); setShowAddRouteSurcharge(true); }} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg flex-shrink-0">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setRouteSurcharges(prev => prev.filter(s => s.id !== sc.id))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {showAddRouteSurcharge && (
                        <div className="border border-dashed border-amber-200 rounded-xl p-4 space-y-3 bg-amber-50/50">
                          <p className="text-xs font-bold text-amber-700">{editingRouteSurchargeId ? (language === 'vi' ? 'Hiệu chỉnh phụ thu' : language === 'ja' ? '追加料金を編集' : 'Edit surcharge') : (language === 'vi' ? 'Thêm phụ thu mới' : language === 'ja' ? '追加料金を追加' : 'Add surcharge')}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Tên phụ thu' : language === 'ja' ? '追加料金名' : 'Surcharge Name'}</label>
                              <input type="text" value={routeSurchargeForm.name} onChange={e => setRouteSurchargeForm(p => ({ ...p, name: e.target.value }))} placeholder={language === 'vi' ? 'VD: Phụ thu Tết 2026, Phụ thu xăng...' : 'e.g. Tet 2026, Fuel Q1...'} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Loại phụ thu' : language === 'ja' ? '追加料金タイプ' : 'Type'}</label>
                              <select value={routeSurchargeForm.type} onChange={e => setRouteSurchargeForm(p => ({ ...p, type: e.target.value as RouteSurcharge['type'] }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200">
                                <option value="FUEL">{language === 'vi' ? 'Xăng dầu' : language === 'ja' ? '燃料' : 'Fuel'}</option>
                                <option value="HOLIDAY">{language === 'vi' ? 'Lễ tết / Mùa cao điểm' : language === 'ja' ? '祝日/ピーク' : 'Holiday / Peak Season'}</option>
                                <option value="OTHER">{language === 'vi' ? 'Khác' : language === 'ja' ? 'その他' : 'Other'}</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{language === 'vi' ? 'Số tiền/người (đ)' : language === 'ja' ? '金額/人 (đ)' : 'Amount/person (đ)'}</label>
                              <input type="number" min="0" step="1" value={routeSurchargeForm.amount} placeholder="0" onChange={e => setRouteSurchargeForm(p => ({ ...p, amount: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-white border border-amber-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Từ ngày (tuỳ chọn)' : language === 'ja' ? '開始日（任意）' : 'From date (optional)'}</label>
                              <input type="date" value={routeSurchargeForm.startDate || ''} onChange={e => setRouteSurchargeForm(p => ({ ...p, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Đến ngày (tuỳ chọn)' : language === 'ja' ? '終了日（任意）' : 'To date (optional)'}</label>
                              <input type="date" value={routeSurchargeForm.endDate || ''} onChange={e => setRouteSurchargeForm(p => ({ ...p, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 italic">{language === 'vi' ? 'Để trống cả hai ngày nếu phụ thu áp dụng toàn thời gian. Phải điền cả hai ngày để giới hạn khoảng thời gian áp dụng.' : language === 'ja' ? '常時適用する場合は両方の日付を空白にしてください。期間を設定する場合は両方の日付が必要です。' : 'Leave both dates empty if the surcharge applies at all times. Both dates must be set to limit the applied period.'}</p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={routeSurchargeForm.isActive} onChange={e => setRouteSurchargeForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                              {language === 'vi' ? 'Đang áp dụng' : language === 'ja' ? '有効' : 'Active now'}
                            </label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddRouteSurcharge(false); setEditingRouteSurchargeId(null); setRouteSurchargeForm({ name: '', type: 'FUEL', amount: '', isActive: true }); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                             <button
                              disabled={!routeSurchargeForm.name || (!!routeSurchargeForm.startDate !== !!routeSurchargeForm.endDate)}
                              onClick={() => {
                                const formToSave = { ...routeSurchargeForm, amount: Number(routeSurchargeForm.amount) || 0 };
                                if (editingRouteSurchargeId) {
                                  setRouteSurcharges(prev => prev.map(s => s.id === editingRouteSurchargeId ? { ...s, ...formToSave } : s));
                                  setEditingRouteSurchargeId(null);
                                } else {
                                  const newSurcharge: RouteSurcharge = { id: crypto.randomUUID(), ...formToSave };
                                  setRouteSurcharges(prev => [...prev, newSurcharge]);
                                }
                                setShowAddRouteSurcharge(false);
                                setRouteSurchargeForm({ name: '', type: 'FUEL', amount: '', isActive: true });
                              }}
                              className="px-4 py-1.5 bg-amber-500 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Route Stops (Intermediate Stops / Sub-route) */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Điểm dừng / Tuyến phụ' : language === 'ja' ? '経由地 / サブルート' : 'Stops / Sub-routes'}</p>
                          <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Điểm xuất phát và điểm đến được tạo tự động. Thêm điểm dừng trung gian nếu cần.' : 'Departure and arrival are auto-generated. Add intermediate stops as needed.'}</p>
                        </div>
                        {!showAddRouteStop && (
                          <button onClick={() => { setShowAddRouteStop(true); setEditingRouteStop(null); setRouteStopForm({ stopId: '', stopName: '', order: routeFormStops.length + 1 }); }} className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100">
                            + {language === 'vi' ? 'Thêm điểm dừng' : 'Add stop'}
                          </button>
                        )}
                      </div>

                      {/* Auto-generated departure stop */}
                      {routeForm.departurePoint && (
                        <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                          <span className="w-6 h-6 flex-shrink-0 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">A</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{routeForm.departurePoint}</p>
                            <p className="text-[10px] text-green-600">{language === 'vi' ? 'Điểm xuất phát (tự động)' : 'Departure (auto-generated)'}</p>
                          </div>
                        </div>
                      )}

                      {routeFormStops.length === 0 && !showAddRouteStop && (
                        <p className="text-xs text-gray-400 text-center py-1">{language === 'vi' ? 'Không có điểm dừng trung gian – nhấn "Thêm điểm dừng" để thêm' : 'No intermediate stops – click "Add stop" to add one'}</p>
                      )}

                      {[...routeFormStops].sort((a, b) => a.order - b.order).map((stop, idx, sortedArr) => (
                        <div key={stop.stopId || idx} className="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
                          <span className="w-6 h-6 flex-shrink-0 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{stop.stopName}</p>
                            <p className="text-[10px] text-gray-400">{stop.stopId}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => {
                                if (idx === 0) return;
                                const prevStop = sortedArr[idx - 1];
                                setRouteFormStopsHistory(prev => [...prev, routeFormStops]);
                                setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                setRouteFormStops(prev => prev.map(s => {
                                  if (s.stopId === stop.stopId) return { ...s, order: prevStop.order };
                                  if (s.stopId === prevStop.stopId) return { ...s, order: stop.order };
                                  return s;
                                }));
                              }}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-purple-600 disabled:opacity-30 text-xs font-bold"
                            >↑</button>
                            <button
                              onClick={() => {
                                if (idx === sortedArr.length - 1) return;
                                const nextStop = sortedArr[idx + 1];
                                setRouteFormStopsHistory(prev => [...prev, routeFormStops]);
                                setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                setRouteFormStops(prev => prev.map(s => {
                                  if (s.stopId === stop.stopId) return { ...s, order: nextStop.order };
                                  if (s.stopId === nextStop.stopId) return { ...s, order: stop.order };
                                  return s;
                                }));
                              }}
                              disabled={idx === sortedArr.length - 1}
                              className="p-1 text-gray-400 hover:text-purple-600 disabled:opacity-30 text-xs font-bold"
                            >↓</button>
                            <button
                              onClick={() => {
                                setEditingRouteStop(stop);
                                setRouteStopForm({ stopId: stop.stopId, stopName: stop.stopName, order: stop.order });
                                setShowAddRouteStop(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded"
                            ><Edit3 size={12} /></button>
                            <button onClick={() => { setRouteFormStopsHistory(prev => [...prev, routeFormStops]); setRouteFormFaresHistory(prev => [...prev, routeFormFares]); setRouteFormStops(prev => prev.filter(s => s.stopId !== stop.stopId).map((s, i) => ({ ...s, order: i + 1 }))); setRouteFormFares(prev => prev.filter(f => f.fromStopId !== stop.stopId && f.toStopId !== stop.stopId)); }} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}

                      {/* Auto-generated arrival stop */}
                      {routeForm.arrivalPoint && (
                        <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                          <span className="w-6 h-6 flex-shrink-0 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">B</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{routeForm.arrivalPoint}</p>
                            <p className="text-[10px] text-blue-600">{language === 'vi' ? 'Điểm đến (tự động)' : 'Destination (auto-generated)'}</p>
                          </div>
                        </div>
                      )}

                      {showAddRouteStop && (
                        <div className="border border-dashed border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/50">
                          <p className="text-xs font-bold text-purple-600">{editingRouteStop ? (language === 'vi' ? 'Chỉnh sửa điểm dừng' : 'Edit Stop') : (language === 'vi' ? 'Thêm điểm dừng' : 'Add Stop')}</p>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Chọn điểm dừng' : 'Select stop'}</label>
                              <select
                                value={routeStopForm.stopId}
                                onChange={e => {
                                  const stop = stops.find(s => s.id === e.target.value);
                                  setRouteStopForm(p => ({ ...p, stopId: e.target.value, stopName: stop?.name || '' }));
                                }}
                                className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                              >
                                <option value="">{language === 'vi' ? '-- Chọn điểm dừng --' : '-- Select stop --'}</option>
                                {stops.filter(s => !routeFormStops.find(rs => rs.stopId === s.id) || s.id === editingRouteStop?.stopId).map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddRouteStop(false); setEditingRouteStop(null); setRouteStopForm({ stopId: '', stopName: '', order: routeFormStops.length + 1 }); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                            <button
                              disabled={!routeStopForm.stopId}
                              onClick={() => {
                                const newStop: RouteStop = { stopId: routeStopForm.stopId, stopName: routeStopForm.stopName || stops.find(s => s.id === routeStopForm.stopId)?.name || '', order: routeStopForm.order };
                                setRouteFormStopsHistory(prev => [...prev, routeFormStops]);
                                setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                if (editingRouteStop) {
                                  setRouteFormStops(prev => {
                                    const updated = prev.map(s => s.stopId === editingRouteStop.stopId ? newStop : s);
                                    return [...updated].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
                                  });
                                  // If the stop ID changed, remove fares referencing the old stopId
                                  // because the old fare's Firestore docId encodes the original stopIds
                                  // and cannot be remapped without creating new Firestore documents.
                                  if (editingRouteStop.stopId !== newStop.stopId) {
                                    setRouteFormFares(prev => prev.filter(f => f.fromStopId !== editingRouteStop.stopId && f.toStopId !== editingRouteStop.stopId));
                                  }
                                } else {
                                  setRouteFormStops(prev => {
                                    const updated = [...prev, newStop].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
                                    return updated;
                                  });
                                }
                                setShowAddRouteStop(false);
                                setEditingRouteStop(null);
                                setRouteStopForm({ stopId: '', stopName: '', order: routeFormStops.length + 2 });
                              }}
                              className="px-4 py-1.5 bg-purple-600 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                            >
                              {t.save}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fare Table (per-segment pricing) */}
                    {(routeForm.departurePoint && routeForm.arrivalPoint) && (
                      <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Bảng giá theo chặng' : language === 'ja' ? '区間別運賃表' : 'Segment Fare Table'}</p>
                            <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Giá vé lẻ và đại lý cho từng cặp điểm đón/trả (có thể đặt thời hạn áp dụng)' : 'Retail and agent prices for each from→to stop pair (optional date range)'}</p>
                          </div>
                          {!showAddRouteFare && (
                            <button onClick={() => { setShowAddRouteFare(true); setEditingRouteFareIdx(null); setRouteFareForm({ fromStopId: '', toStopId: '', price: routeForm.price, agentPrice: routeForm.agentPrice, startDate: '', endDate: '' }); }} className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold hover:bg-teal-100">
                              + {language === 'vi' ? 'Thêm giá chặng' : 'Add fare'}
                            </button>
                          )}
                        </div>

                        {routeFormFares.length === 0 && !showAddRouteFare && (
                          <p className="text-xs text-gray-400 text-center py-2">{language === 'vi' ? 'Chưa có giá chặng – nhấn nút để thêm' : 'No segment fares yet – click to add'}</p>
                        )}

                        {routeFormFares.map((fare, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-teal-50 rounded-xl p-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-gray-800 truncate">{fare.fromName} → {fare.toName}</p>
                              <div className="flex gap-3 mt-1 flex-wrap">
                                <span className="text-xs font-bold text-daiichi-red">{fare.price.toLocaleString()}đ</span>
                                {fare.agentPrice > 0 && <span className="text-xs font-bold text-orange-600">{language === 'vi' ? 'ĐL' : 'Agt'}: {fare.agentPrice.toLocaleString()}đ</span>}
                                {(fare.startDate || fare.endDate) && (
                                  <span className="text-xs text-gray-400">
                                    {fare.startDate && fare.endDate ? `${fare.startDate} → ${fare.endDate}` : fare.startDate ? `${language === 'vi' ? 'Từ' : 'From'} ${fare.startDate}` : `${language === 'vi' ? 'Đến' : 'To'} ${fare.endDate}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => {
                                  if (idx === 0) return;
                                  setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                  setRouteFormFares(prev => {
                                    const next = [...prev];
                                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                    return next;
                                  });
                                }}
                                disabled={idx === 0}
                                className="p-0.5 text-gray-400 hover:text-teal-600 disabled:opacity-30 text-xs font-bold leading-none"
                              >↑</button>
                              <button
                                onClick={() => {
                                  if (idx === routeFormFares.length - 1) return;
                                  setRouteFormFaresHistory(prev => [...prev, routeFormFares]);
                                  setRouteFormFares(prev => {
                                    const next = [...prev];
                                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                    return next;
                                  });
                                }}
                                disabled={idx === routeFormFares.length - 1}
                                className="p-0.5 text-gray-400 hover:text-teal-600 disabled:opacity-30 text-xs font-bold leading-none"
                              >↓</button>
                            </div>
                            <button onClick={() => { setEditingRouteFareIdx(idx); setRouteFareForm({ fromStopId: fare.fromStopId, toStopId: fare.toStopId, price: fare.price, agentPrice: fare.agentPrice, startDate: fare.startDate, endDate: fare.endDate }); setShowAddRouteFare(true); }} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-100 rounded-lg flex-shrink-0">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setRouteFormFares(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                        {showAddRouteFare && (
                          <div className="border border-dashed border-teal-200 rounded-xl p-4 space-y-3 bg-teal-50/50">
                            <p className="text-xs font-bold text-teal-700">{editingRouteFareIdx !== null ? (language === 'vi' ? 'Hiệu chỉnh giá chặng' : language === 'ja' ? '区間運賃を編集' : 'Edit segment fare') : (language === 'vi' ? 'Thêm giá chặng mới' : language === 'ja' ? '区間運賃を追加' : 'Add segment fare')}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Từ điểm' : 'From stop'}</label>
                                <select value={routeFareForm.fromStopId} onChange={e => setRouteFareForm(p => ({ ...p, fromStopId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200">
                                  <option value="">{language === 'vi' ? '-- Chọn --' : '-- Select --'}</option>
                                  {allRouteStops.map(s => (
                                    <option key={s.stopId} value={s.stopId}>{s.stopName}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Đến điểm' : 'To stop'}</label>
                                <select value={routeFareForm.toStopId} onChange={e => setRouteFareForm(p => ({ ...p, toStopId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200">
                                  <option value="">{language === 'vi' ? '-- Chọn --' : '-- Select --'}</option>
                                  {allRouteStops.filter(s => s.stopId !== routeFareForm.fromStopId).map(s => (
                                    <option key={s.stopId} value={s.stopId}>{s.stopName}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_price} (đ)</label>
                                <input type="number" min="0" value={routeFareForm.price} onChange={e => setRouteFareForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t.agent_price} (đ)</label>
                                <input type="number" min="0" value={routeFareForm.agentPrice} onChange={e => setRouteFareForm(p => ({ ...p, agentPrice: parseInt(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Áp dụng từ ngày' : 'Valid from'}</label>
                                <input type="date" value={routeFareForm.startDate} onChange={e => setRouteFareForm(p => ({ ...p, startDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Đến ngày' : 'Valid until'}</label>
                                <input type="date" value={routeFareForm.endDate} onChange={e => setRouteFareForm(p => ({ ...p, endDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setShowAddRouteFare(false); setEditingRouteFareIdx(null); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600">{t.cancel}</button>
                              <button
                                disabled={!routeFareForm.fromStopId || !routeFareForm.toStopId || routeFareForm.fromStopId === routeFareForm.toStopId}
                                onClick={() => {
                                  const fromStop = allRouteStops.find(s => s.stopId === routeFareForm.fromStopId);
                                  const toStop = allRouteStops.find(s => s.stopId === routeFareForm.toStopId);
                                  if (!fromStop || !toStop) return;
                                  // Validate order: from must come before to
                                  if (fromStop.order >= toStop.order) {
                                    alert(language === 'vi' ? 'Điểm đón phải nằm trước điểm trả trong hành trình' : 'From stop must come before to stop in route order');
                                    return;
                                  }
                                  const newFare = { fromStopId: routeFareForm.fromStopId, toStopId: routeFareForm.toStopId, fromName: fromStop.stopName, toName: toStop.stopName, price: routeFareForm.price, agentPrice: routeFareForm.agentPrice, startDate: routeFareForm.startDate, endDate: routeFareForm.endDate };
                                  if (editingRouteFareIdx !== null) {
                                    // Check for duplicate pair (excluding the current editing index)
                                    const duplicate = routeFormFares.findIndex((f, i) => i !== editingRouteFareIdx && f.fromStopId === routeFareForm.fromStopId && f.toStopId === routeFareForm.toStopId);
                                    if (duplicate >= 0) {
                                      alert(language === 'vi' ? 'Giá chặng cho cặp điểm này đã tồn tại' : 'A fare for this stop pair already exists');
                                      return;
                                    }
                                    // Update the fare at the editing index
                                    setRouteFormFares(prev => prev.map((f, i) => i === editingRouteFareIdx ? newFare : f));
                                  } else {
                                    setRouteFormFares(prev => {
                                      const existing = prev.findIndex(f => f.fromStopId === routeFareForm.fromStopId && f.toStopId === routeFareForm.toStopId);
                                      if (existing >= 0) {
                                        return prev.map((f, i) => i === existing ? newFare : f);
                                      }
                                      return [...prev, newFare];
                                    });
                                  }
                                  setShowAddRouteFare(false);
                                  setEditingRouteFareIdx(null);
                                  setRouteFareForm({ fromStopId: '', toStopId: '', price: routeForm.price, agentPrice: routeForm.agentPrice, startDate: '', endDate: '' });
                                }}
                                className="px-4 py-1.5 bg-teal-600 text-white text-xs rounded-lg font-bold disabled:opacity-50"
                              >
                                {t.save}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pickup / Dropoff Address Settings (Cấu hình điểm đón / điểm trả) */}
                    <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Cấu hình điểm đón / điểm trả' : language === 'ja' ? '乗降地点の設定' : 'Pickup / Dropoff Settings'}</p>
                        <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Bật vô hiệu hóa để ẩn ô nhập điểm đón hoặc điểm trả trên trang đặt vé' : 'Enable to hide pickup or dropoff address input on the booking page'}</p>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={routeForm.disablePickupAddress}
                              onChange={e => setRouteForm(f => ({ ...f, disablePickupAddress: e.target.checked }))}
                              className="w-4 h-4 accent-daiichi-red rounded"
                            />
                            <span className="text-sm text-gray-700">{language === 'vi' ? 'Vô hiệu hóa ô nhập điểm đón' : language === 'ja' ? '乗車地点の入力を無効化' : 'Disable pickup address input'}</span>
                          </label>
                          {routeForm.disablePickupAddress && (
                            <div className="ml-7 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'Từ ngày' : language === 'ja' ? '開始日' : 'From'}</span>
                              <input
                                type="date"
                                value={routeForm.disablePickupAddressFrom}
                                onChange={e => setRouteForm(f => ({ ...f, disablePickupAddressFrom: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'đến ngày' : language === 'ja' ? '終了日' : 'to'}</span>
                              <input
                                type="date"
                                value={routeForm.disablePickupAddressTo}
                                onChange={e => setRouteForm(f => ({ ...f, disablePickupAddressTo: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-[10px] text-gray-400">{language === 'vi' ? '(để trống = luôn vô hiệu)' : '(leave empty = always disabled)'}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={routeForm.disableDropoffAddress}
                              onChange={e => setRouteForm(f => ({ ...f, disableDropoffAddress: e.target.checked }))}
                              className="w-4 h-4 accent-daiichi-red rounded"
                            />
                            <span className="text-sm text-gray-700">{language === 'vi' ? 'Vô hiệu hóa ô nhập điểm trả' : language === 'ja' ? '降車地点の入力を無効化' : 'Disable dropoff address input'}</span>
                          </label>
                          {routeForm.disableDropoffAddress && (
                            <div className="ml-7 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'Từ ngày' : language === 'ja' ? '開始日' : 'From'}</span>
                              <input
                                type="date"
                                value={routeForm.disableDropoffAddressFrom}
                                onChange={e => setRouteForm(f => ({ ...f, disableDropoffAddressFrom: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-xs text-gray-500">{language === 'vi' ? 'đến ngày' : language === 'ja' ? '終了日' : 'to'}</span>
                              <input
                                type="date"
                                value={routeForm.disableDropoffAddressTo}
                                onChange={e => setRouteForm(f => ({ ...f, disableDropoffAddressTo: e.target.value }))}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                              />
                              <span className="text-[10px] text-gray-400">{language === 'vi' ? '(để trống = luôn vô hiệu)' : '(leave empty = always disabled)'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                  <div className="flex justify-end gap-4 pt-2">
                    <button onClick={() => { setShowAddRoute(false); setEditingRoute(null); setIsCopyingRoute(false); setRouteModalEditingId(null); }} className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600">{t.cancel}</button>
                    <button onClick={handleSaveRoute} disabled={!routeForm.name} className="px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 disabled:opacity-50">{editingRoute ? t.save : isCopyingRoute ? t.create_copy : t.add_route}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Search bar + Advanced Filter Toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={routeSearch}
                    onChange={e => setRouteSearch(e.target.value)}
                    placeholder={language === 'vi' ? 'Tìm kiếm tuyến đường...' : 'Search routes...'}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                  />
                  {routeSearch && (
                    <button onClick={() => setRouteSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowRouteFilters(p => !p)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    showRouteFilters ? 'bg-daiichi-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Filter size={15} />
                  {language === 'vi' ? 'Lọc nâng cao' : 'Advanced Filter'}
                  {(routeFilterDeparture || routeFilterArrival) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded text-[10px] font-bold">
                      {[routeFilterDeparture, routeFilterArrival].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {(routeSearch || routeFilterDeparture || routeFilterArrival) && (
                  <button
                    onClick={() => { setRouteSearch(''); setRouteFilterDeparture(''); setRouteFilterArrival(''); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                  >
                    <X size={14} />
                    {language === 'vi' ? 'Xóa bộ lọc' : 'Clear Filters'}
                  </button>
                )}
              </div>
              {showRouteFilters && (
                <div className="flex gap-4 flex-wrap pt-1 border-t border-gray-100">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.departure_point}</label>
                    <input
                      type="text"
                      value={routeFilterDeparture}
                      onChange={e => setRouteFilterDeparture(e.target.value)}
                      placeholder={language === 'vi' ? 'Lọc theo điểm đi...' : 'Filter by departure...'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{t.arrival_point}</label>
                    <input
                      type="text"
                      value={routeFilterArrival}
                      onChange={e => setRouteFilterArrival(e.target.value)}
                      placeholder={language === 'vi' ? 'Lọc theo điểm đến...' : 'Filter by arrival...'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <ResizableTh width={routeColWidths.stt} onResize={(w) => setRouteColWidths(p => ({ ...p, stt: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">STT</ResizableTh>
                    <ResizableTh width={routeColWidths.name} onResize={(w) => setRouteColWidths(p => ({ ...p, name: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.route_name}</ResizableTh>
                    <ResizableTh width={routeColWidths.departure} onResize={(w) => setRouteColWidths(p => ({ ...p, departure: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.departure_point}</ResizableTh>
                    <ResizableTh width={routeColWidths.arrival} onResize={(w) => setRouteColWidths(p => ({ ...p, arrival: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.arrival_point}</ResizableTh>
                    <ResizableTh width={routeColWidths.price} onResize={(w) => setRouteColWidths(p => ({ ...p, price: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ticket_price}</ResizableTh>
                    <ResizableTh width={routeColWidths.agentPrice} onResize={(w) => setRouteColWidths(p => ({ ...p, agentPrice: w }))} className="px-6 py-5 text-[10px] font-bold text-orange-400 uppercase tracking-widest">{t.agent_price}</ResizableTh>
                    <ResizableTh width={routeColWidths.options} onResize={(w) => setRouteColWidths(p => ({ ...p, options: w }))} className="px-6 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.options}</ResizableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-6 text-sm text-gray-500">{route.stt}</td>
                      <td className="px-6 py-6">
                        <p className="font-bold text-gray-800">{route.name}</p>
                        {(route.pricePeriods || []).length > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                            <Calendar size={10} /> {(route.pricePeriods || []).length} {language === 'vi' ? 'kỳ giá' : 'periods'}
                          </span>
                        )}
                        {(() => {
                          const intermediateStops = (route.routeStops || []).filter(s => s.stopId !== STOP_ID_DEPARTURE && s.stopId !== STOP_ID_ARRIVAL);
                          return intermediateStops.length > 0 ? (
                            <span className="inline-flex items-center gap-1 mt-1 ml-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold">
                              {intermediateStops.length} {language === 'vi' ? 'điểm dừng' : 'stops'}
                            </span>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-6 py-6"><p className="text-xs text-gray-500 max-w-[200px]">{route.departurePoint}</p></td>
                      <td className="px-6 py-6"><p className="text-xs text-gray-500 max-w-[200px]">{route.arrivalPoint}</p></td>
                      <td className="px-6 py-6"><p className="font-bold text-daiichi-red">{route.price > 0 ? `${route.price.toLocaleString()}đ` : t.contact}</p></td>
                      <td className="px-6 py-6"><p className="font-bold text-orange-600">{(route.agentPrice || 0) > 0 ? `${(route.agentPrice || 0).toLocaleString()}đ` : '—'}</p></td>
                      <td className="px-6 py-6"><div className="flex gap-3 items-center"><button onClick={() => exportRouteToPDF(route)} title={language === 'vi' ? 'Xuất PDF' : language === 'ja' ? 'PDFを出力' : 'Export PDF'} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded"><FileText size={18} /></button><button onClick={() => handleCopyRoute(route)} title={t.copy_route} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-1 rounded"><Copy size={18} /></button><button onClick={() => handleStartEditRoute(route)} className="text-gray-600 hover:text-daiichi-red"><Edit3 size={18} /></button><button onClick={() => handleDeleteRoute(route.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={18} /></button><NotePopover note={route.note} onSave={(note) => handleSaveRouteNote(route.id, note)} language={language} /></div></td>
                    </tr>
                  ))}
                  {filteredRoutes.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">{language === 'vi' ? 'Không tìm thấy tuyến đường nào.' : 'No routes found.'}</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        );
}
