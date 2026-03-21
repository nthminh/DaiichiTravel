import React from 'react'
import { Bus, Users, Calendar, MapPin, Search, Clock, X, CheckCircle2, AlertTriangle, Phone, Gift } from 'lucide-react'
import { cn, getLocalDateString } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole } from '../App'
import { SeatStatus, TripStatus, Trip, Route, Stop, TripAddon, Vehicle } from '../types'
import { matchesSearch } from '../lib/searchUtils'
import { SearchableSelect } from '../components/SearchableSelect'
import { motion } from 'motion/react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'

interface BookTicketPageProps {
  trips: Trip[];
  routes: Route[];
  vehicles: Vehicle[];
  language: Language;
  searchFrom: string;
  searchTo: string;
  searchDate: string;
  searchReturnDate: string;
  vehicleTypeFilter: string;
  bookTicketSearch: string;
  priceMin: string;
  priceMax: string;
  searchTimeFrom: string;
  searchTimeTo: string;
  hasSearched: boolean;
  clearedTripCards: Set<string>;
  searchAdults: number;
  searchChildren: number;
  roundTripPhase: 'outbound' | 'return';
  outboundBookingData: any;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  showInquiryForm: boolean;
  inquiryName: string;
  inquiryPhone: string;
  inquiryEmail: string;
  inquiryNotes: string;
  inquiryLoading: boolean;
  inquirySuccess: boolean;
  inquiryError: string;
  currentUser: any | null;
  tripCardImgIdx: Record<string, number>;
  paymentConfig: { bookingCutoffEnabled: boolean; bookingCutoffMinutes: number };
  showAddonDetailTrip: Trip | null;
  // Handlers
  setSearchFrom: (v: string) => void;
  setSearchTo: (v: string) => void;
  setSearchDate: (v: string) => void;
  setSearchReturnDate: (v: string) => void;
  setBookTicketSearch: (v: string) => void;
  setPriceMin: (v: string) => void;
  setPriceMax: (v: string) => void;
  setSearchTimeFrom: (v: string) => void;
  setSearchTimeTo: (v: string) => void;
  setHasSearched: (v: boolean) => void;
  setClearedTripCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSearchAdults: React.Dispatch<React.SetStateAction<number>>;
  setSearchChildren: React.Dispatch<React.SetStateAction<number>>;
  setTripType: (v: 'ONE_WAY' | 'ROUND_TRIP') => void;
  setShowInquiryForm: (v: boolean) => void;
  setInquiryName: (v: string) => void;
  setInquiryPhone: (v: string) => void;
  setInquiryEmail: (v: string) => void;
  setInquiryNotes: (v: string) => void;
  setInquirySuccess: (v: boolean) => void;
  handleInquirySubmit: () => void;
  setSelectedTrip: (trip: any) => void;
  setPreviousTab: (tab: string) => void;
  setActiveTab: (tab: string) => void;
  setRoundTripPhase: (phase: 'outbound' | 'return') => void;
  setTripCardImgIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setShowAddonDetailTrip: (trip: Trip | null) => void;
  // Helpers
  compareTripDateTime: (a: { date?: string; time?: string }, b: { date?: string; time?: string }) => number;
  formatTripDateDisplay: (dateStr: string) => string;
}

export function BookTicketPage({
  trips,
  routes,
  vehicles,
  language,
  searchFrom,
  searchTo,
  searchDate,
  searchReturnDate,
  vehicleTypeFilter,
  bookTicketSearch,
  priceMin,
  priceMax,
  searchTimeFrom,
  searchTimeTo,
  hasSearched,
  clearedTripCards,
  searchAdults,
  searchChildren,
  roundTripPhase,
  outboundBookingData,
  tripType,
  showInquiryForm,
  inquiryName,
  inquiryPhone,
  inquiryEmail,
  inquiryNotes,
  inquiryLoading,
  inquirySuccess,
  inquiryError,
  currentUser,
  tripCardImgIdx,
  paymentConfig,
  showAddonDetailTrip,
  setSearchFrom,
  setSearchTo,
  setSearchDate,
  setSearchReturnDate,
  setBookTicketSearch,
  setPriceMin,
  setPriceMax,
  setSearchTimeFrom,
  setSearchTimeTo,
  setHasSearched,
  setClearedTripCards,
  setSearchAdults,
  setSearchChildren,
  setTripType,
  setShowInquiryForm,
  setInquiryName,
  setInquiryPhone,
  setInquiryEmail,
  setInquiryNotes,
  setInquirySuccess,
  handleInquirySubmit,
  setSelectedTrip,
  setPreviousTab,
  setActiveTab,
  setRoundTripPhase,
  setTripCardImgIdx,
  setShowAddonDetailTrip,
  compareTripDateTime,
  formatTripDateDisplay,
}: BookTicketPageProps) {
  const t = TRANSLATIONS[language];
  const { toasts, showToast, dismissToast } = useToast();

  const routeByName = new Map(routes.map(r => [r.name, r]));

  const filterTrip = (trip: Trip, includeDate: boolean) => {
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    const effectiveFrom = isReturnPhase ? searchTo : searchFrom;
    const effectiveTo = isReturnPhase ? searchFrom : searchTo;
    const effectiveDate = isReturnPhase ? searchReturnDate : searchDate;

    if (trip.status !== TripStatus.WAITING) return false;
    const tripVehicle = (bookTicketSearch || vehicleTypeFilter)
      ? vehicles.find(v => v.licensePlate === trip.licensePlate)
      : undefined;
    if (bookTicketSearch) {
      const searchable = [
        trip.route || '',
        trip.driverName || '',
        trip.licensePlate || '',
        trip.time || '',
        trip.date || '',
        String(trip.price || ''),
        tripVehicle?.type || '',
      ].join(' ');
      if (!matchesSearch(searchable, bookTicketSearch)) return false;
    }
    const tripRoute = routeByName.get(trip.route);
    const departureText = tripRoute ? tripRoute.departurePoint : trip.route || '';
    const arrivalText = tripRoute ? tripRoute.arrivalPoint : trip.route || '';
    if (effectiveFrom && !matchesSearch(departureText, effectiveFrom)) return false;
    if (effectiveTo && !matchesSearch(arrivalText, effectiveTo)) return false;
    if (includeDate && effectiveDate && trip.date && trip.date !== effectiveDate) return false;
    if (vehicleTypeFilter && (!tripVehicle || tripVehicle.type !== vehicleTypeFilter)) return false;
    if (priceMin) {
      const minVal = parseInt(priceMin);
      if (!isNaN(minVal) && trip.price < minVal) return false;
    }
    if (priceMax) {
      const maxVal = parseInt(priceMax);
      if (!isNaN(maxVal) && trip.price > maxVal) return false;
    }
    // Time-range filter: HH:MM strings compare correctly lexicographically
    // (e.g. '06:00' < '14:30' < '23:59'), so a direct string comparison is safe.
    if (searchTimeFrom && trip.time && trip.time < searchTimeFrom) return false;
    if (searchTimeTo && trip.time && trip.time > searchTimeTo) return false;
    const totalPassengers = searchAdults + searchChildren;
    const emptySeats = (trip.seats || []).filter(s => s.status === SeatStatus.EMPTY).length;
    if (emptySeats < totalPassengers) return false;
    return true;
  };

  const handleSearch = () => {
    setHasSearched(true);
    const count = trips.filter(trip => filterTrip(trip, true)).length;
    if (count > 0) {
      showToast(t.search_results_found.replace('{count}', String(count)), 'success');
    } else {
      showToast(t.no_trips_found, 'info');
    }
  };

  // Derive unique departure options from routes
  const departureOptions = Array.from(new Set(routes.map(r => r.departurePoint).filter(Boolean))).sort();

  // Derive unique destination options: only filter to arrivals reachable from the selected departure
  // when the user has made an exact selection (i.e. searchFrom exactly matches a known departure option).
  // While the user is still typing, show all destinations so that each field searches independently.
  const isFromExactlySelected = departureOptions.includes(searchFrom);
  const destinationOptions = Array.from(
    new Set(
      routes
        .filter(r => !searchFrom || !isFromExactlySelected || r.departurePoint === searchFrom)
        .map(r => r.arrivalPoint)
        .filter(Boolean)
    )
  ).sort();

  // Palette of pastel background colors for route cards (Tailwind safe-listed via explicit strings)
  const CARD_BG_COLORS = [
    'bg-blue-50',
    'bg-green-50',
    'bg-purple-50',
    'bg-orange-50',
    'bg-yellow-50',
    'bg-pink-50',
    'bg-teal-50',
    'bg-indigo-50',
  ];

  const getRouteCardBg = (routeName: string) => {
    const idx = routes.findIndex(r => r.name === routeName);
    return CARD_BG_COLORS[(idx >= 0 ? idx : 0) % CARD_BG_COLORS.length];
  };

  const renderTripCard = (trip: Trip, isSuggestion = false) => {
    const tripRoute = routes.find(r => r.name === trip.route);
    const routeImages = (tripRoute?.images && tripRoute.images.length > 0) ? tripRoute.images : (tripRoute?.imageUrl ? [tripRoute.imageUrl] : []);
    const vehicleImg = tripRoute?.vehicleImageUrl;
    const carouselIdx = tripCardImgIdx[trip.id] ?? 0;
    const currentImg = routeImages[carouselIdx] ?? null;
    const isTripRevealed = hasSearched || clearedTripCards.has(trip.id);
    const tripVehicle = vehicles.find(v => v.licensePlate === trip.licensePlate);
    const emptySeats = (trip.seats || []).filter(s => s.status === SeatStatus.EMPTY).length;
    const cardBg = getRouteCardBg(trip.route || '');
    return (
      <div key={trip.id} className={cn(cardBg, "rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col", isSuggestion ? "border-amber-200 opacity-95" : "border-gray-100")}>
        {/* Route name – full-width header row */}
        <div className="px-3 pt-2.5 pb-1">
          <span aria-label={`Tuyến: ${trip.route}`} className="px-2 py-0.5 bg-daiichi-accent text-daiichi-red rounded-full text-[11px] font-bold uppercase block text-center w-full">{trip.route}</span>
        </div>
        {/* 3-column body: [image | schedule info | seats+price+CTA] */}
        {/* Mobile: image full-width on top row, info columns side by side below */}
        {/* Desktop (md+): all 3 columns side by side */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1.5fr_1.5fr] gap-2 px-2 pb-2">
          {/* Column 1: Large route image – full width on mobile, proportional column on desktop */}
          <div className="col-span-2 md:col-span-1 relative overflow-hidden rounded-2xl aspect-video md:aspect-auto md:min-h-[110px]">
            {(currentImg || vehicleImg) ? (
              <>
                {currentImg && (
                  <img
                    src={currentImg}
                    alt={trip.route}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                    style={{ filter: isTripRevealed ? 'none' : 'blur(12px)', transform: isTripRevealed ? 'scale(1)' : 'scale(1.1)' }}
                    referrerPolicy="no-referrer"
                  />
                )}
                {vehicleImg && (
                  <img
                    src={vehicleImg}
                    alt={trip.licensePlate}
                    className="absolute bottom-1 right-1 w-12 h-8 object-cover rounded-lg border-2 border-white shadow-md transition-all duration-700"
                    style={{ filter: isTripRevealed ? 'none' : 'blur(8px)' }}
                    referrerPolicy="no-referrer"
                  />
                )}
                {/* Carousel prev/next buttons */}
                {isTripRevealed && routeImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setTripCardImgIdx(prev => ({ ...prev, [trip.id]: (carouselIdx - 1 + routeImages.length) % routeImages.length })); }}
                      className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-white text-xs hover:bg-black/60 transition-all z-10"
                      aria-label="Previous image"
                    >‹</button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setTripCardImgIdx(prev => ({ ...prev, [trip.id]: (carouselIdx + 1) % routeImages.length })); }}
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-white text-xs hover:bg-black/60 transition-all z-10"
                      aria-label="Next image"
                    >›</button>
                    {/* Dot indicators */}
                    <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5 z-10">
                      {routeImages.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`Ảnh ${idx + 1}`}
                          onClick={e => { e.stopPropagation(); setTripCardImgIdx(prev => ({ ...prev, [trip.id]: idx })); }}
                          className="w-4 h-4 flex items-center justify-center rounded-full transition-all hover:bg-black/20"
                        >
                          <span className={cn("w-1 h-1 rounded-full block transition-all", idx === carouselIdx ? "bg-white" : "bg-white/50")} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {!isTripRevealed && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                    onClick={() => setClearedTripCards(prev => new Set([...prev, trip.id]))}
                  >
                    <span className="text-white text-[9px] font-bold bg-black/40 px-1.5 py-0.5 rounded-full text-center leading-tight">
                      {language === 'vi' ? '👆 Chạm xem ảnh' : '👆 Tap to reveal'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                <Bus size={28} className="text-gray-300" />
              </div>
            )}
          </div>
          {/* Column 2: Vehicle type + departure time + date/schedule */}
          <div className="col-span-1 flex flex-col justify-center gap-1.5 py-1 min-w-0">
            {/* Vehicle type */}
            {tripVehicle?.type && (
              <div className="flex items-center gap-1">
                <Bus size={10} className="flex-shrink-0 text-gray-400" />
                <span className="text-[10px] text-gray-500 truncate">{tripVehicle.type}</span>
              </div>
            )}
            {/* License plate */}
            <span className="text-[9px] text-gray-400 truncate">{trip.licensePlate}</span>
            {/* Departure time */}
            <div>
              <p className="text-2xl font-bold text-green-600 leading-tight">{trip.time}</p>
              <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide">{t.departure}</p>
            </div>
            {/* Date */}
            {trip.date && (
              <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-xs font-bold self-start", isSuggestion ? "bg-amber-100 text-amber-700" : "bg-red-50 text-daiichi-red")}>
                {formatTripDateDisplay(trip.date)}
              </span>
            )}
          </div>
          {/* Column 3: Driver name + Seats left + price + CTA button */}
          <div className="col-span-1 flex flex-col justify-between gap-1.5 py-1 pr-1 min-w-0">
            {/* Driver name */}
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Users size={10} className="flex-shrink-0" />
              <span className="truncate">{trip.driverName}</span>
            </div>
            {/* Seats left */}
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Bus size={10} className="flex-shrink-0" />
              <span className="truncate">{emptySeats} {t.seats_left}</span>
            </div>
            {/* Add-ons badge – clickable to show service details */}
            {(trip.addons || []).length > 0 && (
              <button
                onClick={() => setShowAddonDetailTrip(trip)}
                aria-label={language === 'vi' ? 'Xem chi tiết dịch vụ kèm theo' : language === 'ja' ? '付帯サービスの詳細を見る' : 'View add-on services details'}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-bold border border-emerald-200 self-start hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Gift size={9} />
                {(trip.addons || []).length} {language === 'vi' ? 'dịch vụ' : language === 'ja' ? '付帯' : 'add-ons'}
              </button>
            )}
            {/* Price */}
            <div className="mt-auto">
              {currentUser?.role === UserRole.AGENT && (trip.agentPrice || 0) > 0 ? (
                <div>
                  <p className="text-sm font-bold text-daiichi-red leading-tight">{(trip.agentPrice || 0).toLocaleString()}đ</p>
                  <p className="text-[9px] text-gray-400 line-through">{trip.price.toLocaleString()}đ</p>
                  <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                    💰 {(trip.price - (trip.agentPrice || 0)).toLocaleString()}đ
                  </span>
                </div>
              ) : (
                <p className="text-sm font-bold text-daiichi-red leading-tight">{trip.price.toLocaleString()}đ</p>
              )}
            </div>
            {/* Select seat CTA */}
            {(() => {
              // Merged trips: customers must contact the bus company directly
              if (trip.isMerged) {
                return (
                  <button
                    onClick={() => alert(language === 'vi'
                      ? 'Chuyến này đã được ghép lại. Vui lòng liên hệ nhà xe để đặt chỗ.'
                      : language === 'ja'
                        ? 'この便は統合されました。座席予約はバス会社にお問い合わせください。'
                        : 'This trip has been merged. Please contact the bus company to book.')}
                    className="w-full px-2 py-1.5 bg-orange-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-400/10 cursor-not-allowed"
                  >
                    🔗 {language === 'vi' ? 'Liên hệ nhà xe' : language === 'ja' ? 'バス会社に連絡' : 'Contact Bus Co.'}
                  </button>
                );
              }
              // Check if departure is within the cutoff window for non-staff users
              const isPrivilegedUser = currentUser?.role === UserRole.MANAGER ||
                currentUser?.role === 'SUPERVISOR' ||
                currentUser?.role === 'STAFF';
              let isCutoffBlocked = false;
              if (!isPrivilegedUser && paymentConfig.bookingCutoffEnabled && paymentConfig.bookingCutoffMinutes > 0) {
                const tripDateStr = trip.date;
                const tripTime = trip.time || '00:00';
                if (tripDateStr) {
                  const parts = tripDateStr.split(/[\/\-]/);
                  if (parts.length === 3) {
                    // Build ISO string with explicit Vietnam timezone (+07:00) so the
                    // departure moment is computed correctly regardless of the browser's
                    // local timezone.
                    let isoDate: string;
                    if (tripDateStr.includes('/')) {
                      // DD/MM/YYYY → YYYY-MM-DD
                      isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    } else {
                      isoDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    }
                    const departureDate = new Date(`${isoDate}T${tripTime}:00+07:00`);
                    const msUntilDeparture = departureDate.getTime() - Date.now();
                    isCutoffBlocked = msUntilDeparture <= paymentConfig.bookingCutoffMinutes * 60 * 1000;
                  }
                }
              }
              return isCutoffBlocked ? (
                <button
                  onClick={() => alert(t.booking_cutoff_alert || 'Xe sắp chạy! Vui lòng liên hệ đại lý hoặc nhân viên nhà xe để đặt vé cận giờ.')}
                  className="w-full px-2 py-1.5 bg-gray-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-gray-400/10 cursor-not-allowed"
                >
                  🔒 {language === 'vi' ? 'Liên hệ đại lý' : language === 'ja' ? '代理店にお問い合わせ' : 'Contact Agent'}
                </button>
              ) : (
                <button
                  onClick={() => { setSelectedTrip(trip); setPreviousTab('book-ticket'); setActiveTab('seat-mapping'); }}
                  className="w-full px-2 py-1.5 bg-daiichi-red text-white rounded-xl text-xs font-bold shadow-lg shadow-daiichi-red/10"
                >
                  {t.select_seat}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-6 mb-6">
          <h2 className="text-2xl font-bold">{t.search_title}</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['ONE_WAY', 'ROUND_TRIP'] as const).map((type) => (
              <button 
                key={type}
                onClick={() => setTripType(type)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  tripType === type ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500"
                )}
              >
                {type === 'ONE_WAY' ? t.trip_one_way : t.trip_round_trip}
              </button>
            ))}
          </div>
        </div>
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", tripType === 'ROUND_TRIP' ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.from}</label>
            <div className="relative mt-1">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
              <SearchableSelect
                options={departureOptions}
                value={searchFrom}
                onChange={setSearchFrom}
                placeholder={t.from}
                className="w-full"
                inputClassName="pl-12 py-4"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.to}</label>
            <div className="relative mt-1">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
              <SearchableSelect
                options={destinationOptions}
                value={searchTo}
                onChange={setSearchTo}
                placeholder={t.to}
                className="w-full"
                inputClassName="pl-12 py-4"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.departure_date}</label>
            <div className="relative mt-1">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="date" value={searchDate} min={getLocalDateString(0)} onChange={e => setSearchDate(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
            </div>
          </div>
          {tripType === 'ROUND_TRIP' && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.return_date}</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="date" value={searchReturnDate} min={searchDate || getLocalDateString(0)} onChange={e => setSearchReturnDate(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
              </div>
            </div>
          )}
        </div>
        {/* Passenger count row + search button */}
        <div className="flex items-end gap-3 mt-4 sm:mt-4">
          <div className="flex-1 sm:flex-none grid grid-cols-2 gap-3 sm:gap-4 sm:mt-4 sm:w-64">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 truncate block">{t.num_adults}</label>
              <div className="relative mt-1 flex items-center">
                <button
                  type="button"
                  onClick={() => setSearchAdults(v => Math.max(1, v - 1))}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >−</button>
                <input
                  type="number"
                  min="1"
                  value={searchAdults}
                  onChange={e => setSearchAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center px-8 sm:px-10 py-3 sm:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10 font-bold text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setSearchAdults(v => v + 1)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >+</button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 truncate block">{t.num_children}</label>
              <div className="relative mt-1 flex items-center">
                <button
                  type="button"
                  onClick={() => setSearchChildren(v => Math.max(0, v - 1))}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >−</button>
                <input
                  type="number"
                  min="0"
                  value={searchChildren === 0 ? '' : searchChildren}
                  onChange={e => setSearchChildren(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder=""
                  className="w-full text-center px-8 sm:px-10 py-3 sm:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10 font-bold text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setSearchChildren(v => v + 1)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >+</button>
              </div>
            </div>
          </div>
          {/* Search button – icon-only on mobile, full text on sm+ */}
          <div className="shrink-0 ml-auto sm:flex sm:mt-4">
            <button onClick={handleSearch} className="px-4 sm:px-8 py-3 sm:py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
              <Search size={18} />
              <span className="sm:inline hidden">{t.search_btn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Price Filter Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          {/* Keyword Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.keyword_search}</label>
            <div className="relative mt-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={bookTicketSearch}
                onChange={e => setBookTicketSearch(e.target.value)}
                placeholder={t.keyword_search_placeholder}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
              />
            </div>
          </div>
          {/* Time Range Filter */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.time_filter}</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="time"
                    value={searchTimeFrom}
                    onChange={e => setSearchTimeFrom(e.target.value)}
                    title={t.time_from}
                    className="w-32 pl-9 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                  />
                </div>
                <span className="text-gray-400 font-bold">—</span>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="time"
                    value={searchTimeTo}
                    onChange={e => setSearchTimeTo(e.target.value)}
                    title={t.time_to}
                    className="w-32 pl-9 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Price Range Filter */}
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.price_range}</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  value={priceMin}
                  onChange={e => setPriceMin(e.target.value)}
                  placeholder={t.price_min_placeholder}
                  className="w-36 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                />
                <span className="text-gray-400 font-bold">—</span>
                <input
                  type="number"
                  min="0"
                  value={priceMax}
                  onChange={e => setPriceMax(e.target.value)}
                  placeholder={t.price_max_placeholder}
                  className="w-36 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                />
              </div>
            </div>
            {(bookTicketSearch || priceMin || priceMax || searchTimeFrom || searchTimeTo) && (
              <button
                onClick={() => { setBookTicketSearch(''); setPriceMin(''); setPriceMax(''); setSearchTimeFrom(''); setSearchTimeTo(''); }}
                className="px-4 py-3 text-sm font-bold text-gray-400 hover:text-daiichi-red hover:bg-red-50 rounded-2xl transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Round-trip phase indicator */}
        {tripType === 'ROUND_TRIP' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <h3 className="text-xl font-bold px-2">
              {roundTripPhase === 'outbound' ? t.round_trip_step_1 : t.round_trip_step_2}
            </h3>
            {roundTripPhase === 'return' && (
              <div className="flex items-center gap-3 flex-wrap">
                {outboundBookingData && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">
                    <CheckCircle2 size={12} />
                    {t.round_trip_outbound_done}: {outboundBookingData.route} · {outboundBookingData.time}
                  </span>
                )}
                <button
                  onClick={() => { setRoundTripPhase('outbound'); setShowInquiryForm(false); setInquirySuccess(false); }}
                  className="text-xs font-bold text-gray-500 hover:text-daiichi-red transition-colors"
                >
                  {t.back_to_outbound}
                </button>
              </div>
            )}
          </div>
        )}
        {tripType === 'ONE_WAY' && <h3 className="text-xl font-bold px-2">{t.available_trips}</h3>}

        {(() => {
          const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
          const effectiveFrom = isReturnPhase ? searchTo : searchFrom;
          const effectiveTo = isReturnPhase ? searchFrom : searchTo;
          const effectiveDate = isReturnPhase ? searchReturnDate : searchDate;

          const filteredBookingTrips = trips.filter(t => filterTrip(t, true)).sort((a, b) => compareTripDateTime(a, b));

          // Nearest trips: same route/direction but without date restriction, sorted by date proximity
          const nearestTrips = filteredBookingTrips.length === 0 && (effectiveFrom || effectiveTo)
            ? trips
                .filter(t => filterTrip(t, false))
                .sort((a, b) => {
                  if (!effectiveDate) return compareTripDateTime(a, b);
                  const target = new Date(effectiveDate).getTime();
                  const aDate = new Date(a.date || '9999-12-31').getTime();
                  const bDate = new Date(b.date || '9999-12-31').getTime();
                  return Math.abs(aDate - target) - Math.abs(bDate - target);
                })
                .slice(0, 5)
            : [];

          if (filteredBookingTrips.length > 0) {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBookingTrips.map(trip => renderTripCard(trip, false))}
              </div>
            );
          }

          // Inquiry form (shared for both "nearest trips available" and "no trips at all" cases)
          const inquiryFormEl = !inquirySuccess ? (
            <div className="bg-white p-6 rounded-3xl border border-daiichi-red/20 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-daiichi-red/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Phone size={20} className="text-daiichi-red" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{t.inquiry_title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{t.inquiry_subtitle}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.customer_name} *</label>
                    <input type="text" value={inquiryName} onChange={e => setInquiryName(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                      placeholder={t.enter_name} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.phone_number} *</label>
                    <input type="tel" value={inquiryPhone} onChange={e => setInquiryPhone(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                      placeholder={t.enter_phone} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.inquiry_email_label}</label>
                  <input type="email" value={inquiryEmail} onChange={e => setInquiryEmail(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                    placeholder={t.inquiry_email_ph} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.inquiry_notes_label}</label>
                  <textarea value={inquiryNotes} onChange={e => setInquiryNotes(e.target.value)} rows={3}
                    className="w-full mt-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 resize-none text-sm"
                    placeholder={t.inquiry_notes_ph} />
                </div>
                {inquiryError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600">{inquiryError}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleInquirySubmit}
                  disabled={inquiryLoading || !inquiryName.trim() || !inquiryPhone.trim()}
                  className={cn("w-full py-3 text-white rounded-xl font-bold shadow-lg transition-all", inquiryLoading || !inquiryName.trim() || !inquiryPhone.trim() ? "bg-gray-300 shadow-gray-200 cursor-not-allowed" : "bg-daiichi-red shadow-daiichi-red/20 hover:scale-[1.02]")}
                >
                  {inquiryLoading ? t.inquiry_sending : t.inquiry_submit}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-3xl p-8 text-center">
              <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
              <h4 className="text-xl font-bold text-gray-800 mb-2">{t.inquiry_success_title}</h4>
              <p className="text-sm text-gray-600 max-w-md mx-auto">{t.inquiry_success_desc}</p>
              <button
                onClick={() => { setInquirySuccess(false); setShowInquiryForm(false); }}
                className="mt-5 px-6 py-2.5 bg-white border border-green-200 rounded-xl font-bold text-gray-600 hover:bg-green-50 transition-colors"
              >
                {t.inquiry_search_again}
              </button>
            </div>
          );

          if (nearestTrips.length > 0) {
            return (
              <>
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-700">{t.no_exact_trips}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {nearestTrips.map(trip => renderTripCard(trip, true))}
                </div>
                {!showInquiryForm && !inquirySuccess && (
                  <div className="text-center pt-2 pb-2">
                    <p className="text-sm text-gray-500 mb-3">{t.inquiry_not_satisfied}</p>
                    <button
                      onClick={() => setShowInquiryForm(true)}
                      className="px-6 py-3 border-2 border-daiichi-red text-daiichi-red rounded-2xl font-bold hover:bg-daiichi-accent transition-colors"
                    >
                      {t.inquiry_request_btn}
                    </button>
                  </div>
                )}
                {showInquiryForm && inquiryFormEl}
              </>
            );
          }

          // No trips at all
          return (
            <>
              {!showInquiryForm && !inquirySuccess && (
                <div className="text-center py-10 text-gray-400">
                  <Search size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium mb-4">{t.no_trips_found}</p>
                  <p className="text-sm text-gray-500 mb-3">{t.no_trips_at_all_prompt}</p>
                  <button
                    onClick={() => setShowInquiryForm(true)}
                    className="px-6 py-3 border-2 border-daiichi-red text-daiichi-red rounded-2xl font-bold hover:bg-daiichi-accent transition-colors"
                  >
                    {t.inquiry_request_btn}
                  </button>
                </div>
              )}
              {(showInquiryForm || inquirySuccess) && inquiryFormEl}
            </>
          );
        })()}
      </div>
      {/* Addon detail modal – shown when user clicks gift badge on a trip card */}
      {showAddonDetailTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddonDetailTrip(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="addon-detail-title" className="bg-white rounded-[32px] p-6 max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Gift size={20} className="text-emerald-600" />
                <h3 id="addon-detail-title" className="text-lg font-bold text-emerald-700">
                  {language === 'vi' ? 'Dịch vụ kèm theo' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}
                </h3>
              </div>
              <button onClick={() => setShowAddonDetailTrip(null)} aria-label={language === 'vi' ? 'Đóng' : language === 'ja' ? '閉じる' : 'Close'} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500">{showAddonDetailTrip.time} · {showAddonDetailTrip.route}</p>
            <div className="space-y-3">
              {(showAddonDetailTrip.addons || []).map((addon: TripAddon) => (
                <div key={addon.id} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-800">{addon.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                        {addon.type === 'SIGHTSEEING' ? t.addon_type_sightseeing : addon.type === 'TRANSPORT' ? t.addon_type_transport : addon.type === 'FOOD' ? t.addon_type_food : t.addon_type_other}
                      </span>
                    </div>
                    {addon.description && <p className="text-xs text-gray-500 mt-1">{addon.description}</p>}
                  </div>
                  <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">+{addon.price.toLocaleString()}đ</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
