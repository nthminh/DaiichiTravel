import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bus, Users, Calendar, MapPin, Search, Clock, X, CheckCircle2, AlertTriangle, Phone, Gift } from 'lucide-react'
import { cn, getLocalDateString } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole } from '../App'
import { SeatStatus, TripStatus, Trip, Route, Stop, TripAddon, Vehicle } from '../types'
import { matchesSearch, matchScore } from '../lib/searchUtils'
import { motion } from 'motion/react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'
import { transportService } from '../services/transportService'

// ---------------------------------------------------------------------------
// StopSearchInput – unified autocomplete for departure / destination.
// Searches the global stops collection (sub-stops by name + address, terminals
// by name) and resolves the selection to the parent TERMINAL name so that route
// filtering and fare/time calculations work correctly.
// ---------------------------------------------------------------------------
interface StopSearchInputProps {
  value: string;
  terminalValue: string;
  stops: Stop[];
  placeholder: string;
  nearestHint?: string;
  mustSelectError?: string;
  onChange: (text: string, terminal: string) => void;
}

// Delay (ms) between input blur and checking the selection state, ensuring that
// onMouseDown on a suggestion button fires and updates state before we evaluate.
const BLUR_DEBOUNCE_MS = 150;

function StopSearchInput({ value, terminalValue, stops, placeholder, nearestHint, mustSelectError, onChange }: StopSearchInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMustSelect, setShowMustSelect] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to always access the latest terminalValue inside async callbacks
  const terminalValueRef = useRef(terminalValue);
  terminalValueRef.current = terminalValue;

  interface Suggestion { stop: Stop; terminal: Stop | undefined }

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!value.trim()) return [];
    const results: { sug: Suggestion; score: number }[] = [];
    stops.forEach(stop => {
      if (stop.type === 'TERMINAL') {
        const score = matchScore(stop.name, value);
        if (score > 0) {
          results.push({ sug: { stop, terminal: stop }, score });
        }
      } else {
        const terminal = stops.find(s => s.id === stop.terminalId && s.type === 'TERMINAL');
        const nameScore = matchScore(stop.name, value);
        const addrScore = stop.address ? matchScore(stop.address, value) : 0;
        const score = Math.max(nameScore, addrScore);
        if (score > 0) {
          results.push({ sug: { stop, terminal }, score });
        }
      }
    });
    // Sort: priority stops first (ascending priority number), then by match score descending
    results.sort((a, b) => {
      const aPriority = a.sug.stop.priority && a.sug.stop.priority > 0 ? a.sug.stop.priority : undefined;
      const bPriority = b.sug.stop.priority && b.sug.stop.priority > 0 ? b.sug.stop.priority : undefined;
      const aHas = aPriority !== undefined;
      const bHas = bPriority !== undefined;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) return aPriority! - bPriority!;
      return b.score - a.score;
    });
    return results.slice(0, 8).map(r => r.sug);
  }, [value, stops]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (text: string) => {
    onChange(text, ''); // clear resolved terminal when user types freely
    setShowDropdown(true);
    setShowMustSelect(false);
  };

  const handleSelect = (stop: Stop, terminal: Stop | undefined) => {
    const terminalName = terminal?.name || stop.name;
    onChange(terminalName, terminalName);
    setShowDropdown(false);
    setShowMustSelect(false);
  };

  // When the input loses focus without a confirmed selection, show an error hint.
  const handleBlur = () => {
    // Delay so that onMouseDown on a suggestion fires first (see BLUR_DEBOUNCE_MS)
    setTimeout(() => {
      if (value.trim() && !terminalValueRef.current) {
        setShowMustSelect(true);
      }
      setShowDropdown(false);
    }, BLUR_DEBOUNCE_MS);
  };

  // When a station is confirmed, show a wrapping div so long names are fully visible.
  const isConfirmed = Boolean(terminalValue && !showDropdown);

  const handleEditMode = () => {
    onChange(value, '');
    setShowDropdown(true);
    setShowMustSelect(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin
        className={cn("absolute left-4 z-10 text-gray-400", isConfirmed ? "top-4" : "top-1/2 -translate-y-1/2")}
        size={18}
      />
      {isConfirmed ? (
        // Display mode: text wraps for long station names, click/keyboard to re-edit
        <div
          role="button"
          tabIndex={0}
          aria-label={`${value} – nhấn để chỉnh sửa`}
          className="w-full pl-12 pr-14 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm break-words leading-snug min-h-[56px] cursor-pointer"
          onClick={handleEditMode}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEditMode(); } }}
        >
          {value}
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (value.trim()) setShowDropdown(true); setShowMustSelect(false); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "w-full pl-12 pr-8 py-4 bg-gray-50 border rounded-2xl focus:ring-2 focus:outline-none text-sm",
            showMustSelect
              ? "border-daiichi-red focus:ring-daiichi-red/10"
              : "border-gray-100 focus:ring-daiichi-red/10"
          )}
        />
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange('', ''); setShowDropdown(false); setShowMustSelect(false); }}
          className={cn("absolute right-3 text-gray-300 hover:text-gray-500 transition-colors", isConfirmed ? "top-4" : "top-1/2 -translate-y-1/2")}
          aria-label="Clear"
        >
          <X size={14} />
        </button>
      )}
      {terminalValue && !showDropdown && (
        <span className="absolute right-8 top-4 text-daiichi-red" title={terminalValue}>
          <CheckCircle2 size={14} />
        </span>
      )}
      {showMustSelect && !showDropdown && mustSelectError && (
        <p className="mt-1 text-[11px] text-daiichi-red font-medium px-1">{mustSelectError}</p>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((item, idx) => (
            <button
              key={`${item.stop.id}-${idx}`}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-2"
              onMouseDown={e => { e.preventDefault(); handleSelect(item.stop, item.terminal); }}
            >
              <MapPin size={13} className="flex-shrink-0 mt-0.5 text-daiichi-red" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 break-words">{item.stop.name}</p>
                {item.stop.type !== 'TERMINAL' && item.terminal && (
                  <p className="text-[11px] text-daiichi-red font-semibold break-words">🏢 {item.terminal.name}</p>
                )}
                {item.stop.address && (
                  <p className="text-[10px] text-gray-400 break-words">{item.stop.address}</p>
                )}
              </div>
            </button>
          ))}
          {nearestHint && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-start gap-1.5">
              <span className="text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true">💡</span>
              <p className="text-[10px] text-blue-500 leading-snug">{nearestHint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BookTicketPageProps {
  trips: Trip[];
  routes: Route[];
  vehicles: Vehicle[];
  stops: Stop[];
  language: Language;
  searchFrom: string;
  searchTo: string;
  searchStationFrom: string;
  searchStationTo: string;
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
  setSearchStationFrom: (v: string) => void;
  setSearchStationTo: (v: string) => void;
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
  stops,
  language,
  searchFrom,
  searchTo,
  searchStationFrom,
  searchStationTo,
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
  setSearchStationFrom,
  setSearchStationTo,
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

  // Segment-based fare lookup: map from routeId → { price, agentPrice }
  // Updated whenever the customer's searchFrom / searchTo changes.
  const [segmentFares, setSegmentFares] = useState<Map<string, { price: number; agentPrice?: number }>>(new Map());
  // True once the async fare check for the current from/to pair has completed.
  // Used to filter out trips whose route has no fare configuration for the searched segment.
  const [segmentFaresLoaded, setSegmentFaresLoaded] = useState(false);
  const segmentFareFetchRef = useRef(0);

  useEffect(() => {
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    // Prefer specific stop selection (searchStationFrom/To) over plain city text (searchFrom/To)
    const effectiveFrom = isReturnPhase
      ? (searchStationTo || searchTo)
      : (searchStationFrom || searchFrom);
    const effectiveTo = isReturnPhase
      ? (searchStationFrom || searchFrom)
      : (searchStationTo || searchTo);

    if (!effectiveFrom || !effectiveTo) {
      setSegmentFares(new Map());
      setSegmentFaresLoaded(false);
      return;
    }

    setSegmentFaresLoaded(false);
    const fetchId = ++segmentFareFetchRef.current;

    const fetchFares = async () => {
      const uniqueRouteNames = [...new Set(trips.map(t => t.route))];

      const results = await Promise.all(
        uniqueRouteNames.map(async (routeName) => {
          const route = routes.find(r => r.name === routeName);
          if (!route?.routeStops?.length) return null;

          // Resolve stop IDs (prefer route-embedded stops, fall back to global stops)
          // Use exact match first; fall back to fuzzy match for stop names that may have slight variations
          const fromRouteStop = route.routeStops.find(rs => rs.stopName === effectiveFrom)
            ?? route.routeStops.find(rs => matchesSearch(rs.stopName, effectiveFrom));
          const toRouteStop = route.routeStops.find(rs => rs.stopName === effectiveTo)
            ?? route.routeStops.find(rs => matchesSearch(rs.stopName, effectiveTo));
          const fromGlobalStop = stops.find(s => s.name === effectiveFrom)
            ?? stops.find(s => matchesSearch(s.name, effectiveFrom));
          const toGlobalStop = stops.find(s => s.name === effectiveTo)
            ?? stops.find(s => matchesSearch(s.name, effectiveTo));

          const fromStopId = fromRouteStop?.stopId || fromGlobalStop?.id || '';
          const toStopId = toRouteStop?.stopId || toGlobalStop?.id || '';

          if (!fromStopId || !toStopId) return null;

          try {
            const fare = await transportService.getFare({
              routeId: route.id,
              fromStopId,
              toStopId,
              routeStops: route.routeStops,
              stops,
            });
            return { routeId: route.id, price: fare.price, agentPrice: fare.agentPrice };
          } catch {
            // Fare not configured for this segment
            return null;
          }
        })
      );

      if (fetchId === segmentFareFetchRef.current) {
        const newFares = new Map<string, { price: number; agentPrice?: number }>();
        for (const result of results) {
          if (result) newFares.set(result.routeId, { price: result.price, agentPrice: result.agentPrice });
        }
        setSegmentFares(newFares);
        setSegmentFaresLoaded(true);
      }
    };

    fetchFares();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFrom, searchTo, searchStationFrom, searchStationTo, tripType, roundTripPhase, routes, stops, trips]);

  const routeByName = new Map(routes.map(r => [r.name, r]));

  // Check whether the current from/to combination matches any configured route segment.
  // If both fields have content but no route connects them, we show an inline warning.
  const noSegmentWarning = useMemo(() => {
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    const effectiveFrom = isReturnPhase ? searchTo : searchFrom;
    const effectiveTo = isReturnPhase ? searchFrom : searchTo;
    if (!effectiveFrom || !effectiveTo) return false;
    return !routes.some(r => {
      const orderedStops = [
        r.departurePoint,
        ...(r.routeStops || []).slice().sort((a, b) => a.order - b.order).map(s => s.stopName),
        r.arrivalPoint,
      ].filter(Boolean);
      const fromIdx = orderedStops.findIndex(name => matchesSearch(name as string, effectiveFrom));
      if (fromIdx === -1) return false;
      const toIdx = orderedStops.findIndex(name => matchesSearch(name as string, effectiveTo));
      return toIdx !== -1 && fromIdx < toIdx;
    });
  }, [searchFrom, searchTo, tripType, roundTripPhase, routes]);

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
    if (effectiveFrom || effectiveTo) {
      if (tripRoute) {
        const orderedStops = [
          tripRoute.departurePoint,
          ...(tripRoute.routeStops || [])
            .slice()
            .sort((a, b) => a.order - b.order)
            .map(s => s.stopName),
          tripRoute.arrivalPoint,
        ].filter(Boolean);
        if (effectiveFrom) {
          const fromIdx = orderedStops.findIndex(name => matchesSearch(name, effectiveFrom));
          if (fromIdx === -1) return false;
          if (effectiveTo) {
            const toIdx = orderedStops.findIndex(name => matchesSearch(name, effectiveTo));
            if (toIdx === -1 || fromIdx >= toIdx) return false;
          }
        } else {
          const toIdx = orderedStops.findIndex(name => matchesSearch(name, effectiveTo));
          if (toIdx === -1) return false;
        }
      } else {
        const fallbackText = trip.route || '';
        if (effectiveFrom && !matchesSearch(fallbackText, effectiveFrom)) return false;
        if (effectiveTo && !matchesSearch(fallbackText, effectiveTo)) return false;
      }
    }
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
    // Only show trips whose route has fare configuration for the searched segment.
    // Skip this check when fares haven't loaded yet (avoid false negatives during async fetch).
    // Also skip when tripRoute is unknown (route data not yet loaded) to avoid hiding trips incorrectly.
    if (effectiveFrom && effectiveTo && segmentFaresLoaded) {
      if (tripRoute && !segmentFares.has(tripRoute.id)) return false;
    }
    return true;
  };

  const handleSearch = () => {
    // Block search if the user typed text in a stop field but did not confirm a selection
    const fromUnconfirmed = searchFrom.trim() && !searchStationFrom;
    const toUnconfirmed = searchTo.trim() && !searchStationTo;
    if (fromUnconfirmed || toUnconfirmed) {
      showToast(t.stop_search_must_select, 'error');
      return;
    }
    setHasSearched(true);
    const count = trips.filter(trip => filterTrip(trip, true)).length;
    if (count > 0) {
      showToast(t.search_results_found.replace('{count}', String(count)), 'success');
    } else {
      showToast(t.no_trips_found, 'info');
    }
  };

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
          {/* Column 2: Departure time + vehicle type + date/schedule */}
          <div className="col-span-1 flex flex-col justify-center gap-1.5 py-1 min-w-0">
            {/* Departure time – calculated as base time + offsetMinutes when boarding at an intermediate stop */}
            {trip.time && (() => {
              const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
              // Prefer specific stop selection over plain city text
              const effectiveFrom = isReturnPhase
                ? (searchStationTo || searchTo)
                : (searchStationFrom || searchFrom);
              const isExactDeparture = !effectiveFrom || effectiveFrom === tripRoute?.departurePoint;
              // Find the intermediate stop matching the selected departure to compute offset
              const matchedRouteStop = effectiveFrom
                ? tripRoute?.routeStops?.find(s => s.stopName === effectiveFrom || matchesSearch(s.stopName, effectiveFrom))
                : undefined;
              const offsetMins = matchedRouteStop?.offsetMinutes ?? 0;
              const displayTime = offsetMins > 0 ? (() => {
                const [h, m] = trip.time.split(':').map(Number);
                if (isNaN(h) || isNaN(m)) return trip.time;
                const totalMins = h * 60 + m + offsetMins;
                return `${String(Math.floor(totalMins / 60) % 24).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
              })() : trip.time;
              return (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-lg font-bold text-blue-600 leading-none">{displayTime}</span>
                    {!isExactDeparture && offsetMins === 0 && (
                      <span className="text-xs font-bold text-blue-400 leading-none">~</span>
                    )}
                  </div>
                  {offsetMins > 0 && (
                    <span className="text-[9px] text-gray-400 leading-none">
                      {t.stop_arrival_time_hint || 'Xuất bến lúc'} {trip.time}
                    </span>
                  )}
                </div>
              );
            })()}
            {/* Vehicle type */}
            {tripVehicle?.type && (
              <div className="flex items-center gap-1">
                <Bus size={10} className="flex-shrink-0 text-gray-400" />
                <span className="text-[10px] text-gray-500 truncate">{tripVehicle.type}</span>
              </div>
            )}
            {/* License plate */}
            <span className="text-[9px] text-gray-400 truncate">{trip.licensePlate}</span>
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
            {/* Price – use segment fare when available, fall back to trip.price */}
            <div className="mt-auto">
              {(() => {
                const segFare = tripRoute ? segmentFares.get(tripRoute.id) : undefined;
                const discountPct = trip.discountPercent || 0;
                const isAgent = currentUser?.role === UserRole.AGENT;

                // Retail base: prefer segment fare, fall back to trip default
                const retailBase = segFare ? segFare.price : trip.price;

                // Agent base: prefer segment fare's agentPrice, then trip's agentPrice, then null
                let agentBase: number | null = null;
                if (isAgent) {
                  if (segFare?.agentPrice) {
                    agentBase = segFare.agentPrice;
                  } else if ((trip.agentPrice || 0) > 0) {
                    agentBase = trip.agentPrice!;
                  }
                }

                const basePrice = agentBase !== null ? agentBase : retailBase;
                const discountedPrice = discountPct > 0 ? Math.round(basePrice * (1 - discountPct / 100)) : basePrice;

                if (isAgent && agentBase !== null) {
                  return (
                    <div>
                      <p className="text-sm font-bold text-daiichi-red leading-tight">{discountedPrice.toLocaleString()}đ</p>
                      {discountPct > 0
                        ? <p className="text-[9px] text-gray-400 line-through">{basePrice.toLocaleString()}đ</p>
                        : <p className="text-[9px] text-gray-400 line-through">{retailBase.toLocaleString()}đ</p>}
                      <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                        💰 {(retailBase - discountedPrice).toLocaleString()}đ
                      </span>
                    </div>
                  );
                }
                return discountPct > 0 ? (
                  <div>
                    <p className="text-sm font-bold text-daiichi-red leading-tight">{discountedPrice.toLocaleString()}đ</p>
                    <p className="text-[9px] text-gray-400 line-through">{retailBase.toLocaleString()}đ</p>
                    <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                      🏷️ -{discountPct}%
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-daiichi-red leading-tight">{retailBase.toLocaleString()}đ</p>
                );
              })()}
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
        {/* Footer: departure → destination */}
        {(() => {
          const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
          // Prefer specific stop selection over plain city text when available
          const effectiveFrom = (isReturnPhase ? (searchStationTo || searchTo) : (searchStationFrom || searchFrom)) || tripRoute?.departurePoint || '';
          const effectiveTo = (isReturnPhase ? (searchStationFrom || searchFrom) : (searchStationTo || searchTo)) || tripRoute?.arrivalPoint || '';
          if (!effectiveFrom && !effectiveTo) return null;
          return (
            <div className="px-3 pb-2.5 flex items-start gap-1 text-[10px] text-gray-500 border-t border-gray-100 pt-1.5 mt-0.5">
              <MapPin size={9} className="flex-shrink-0 mt-0.5 text-daiichi-red" />
              <span className="font-medium break-words min-w-0">
                {effectiveFrom || '—'} → {effectiveTo || '—'}
              </span>
            </div>
          );
        })()}
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
            <div className="mt-1">
              <StopSearchInput
                value={searchFrom}
                terminalValue={searchStationFrom}
                stops={stops}
                placeholder={t.stop_search_from_placeholder || t.from}
                nearestHint={t.stop_search_nearest_hint}
                mustSelectError={t.stop_search_must_select}
                onChange={(text, terminal) => { setSearchFrom(text); setSearchStationFrom(terminal); }}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.to}</label>
            <div className="mt-1">
              <StopSearchInput
                value={searchTo}
                terminalValue={searchStationTo}
                stops={stops}
                placeholder={t.stop_search_to_placeholder || t.to}
                nearestHint={t.stop_search_nearest_hint}
                mustSelectError={t.stop_search_must_select}
                onChange={(text, terminal) => { setSearchTo(text); setSearchStationTo(terminal); }}
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
        {/* Inline warning: selected from/to has no matching route segment */}
        {noSegmentWarning && (
          <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <span>{t.no_segment_warning || 'Không tìm thấy chặng nào kết nối hai điểm này. Vui lòng thay đổi điểm đi hoặc điểm đến.'}</span>
          </div>
        )}
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
        {/* Carrier selection hint */}
        <p className="px-2 text-xs text-gray-500 italic">{t.select_carrier_hint}</p>

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
