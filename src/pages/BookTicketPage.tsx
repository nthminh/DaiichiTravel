import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Bus, Users, Calendar, MapPin, Search, Clock, X, CheckCircle2, AlertTriangle, Phone, Gift, ChevronDown, ArrowUpDown } from 'lucide-react'
import { cn, getLocalDateString } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole } from '../App'
import { SeatStatus, TripStatus, Trip, Route, Stop, TripAddon, Vehicle } from '../types'
import { matchesSearch, matchScore } from '../lib/searchUtils'
import { FareError } from '../services/fareService'
import { motion } from 'motion/react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'
import { transportService } from '../services/transportService'

// ---------------------------------------------------------------------------
// SubStopPickerModal – a clean popup dialog for picking a specific sub-stop
// (pickup or dropoff point) after the parent terminal has been confirmed.
// ---------------------------------------------------------------------------
interface SubStopPickerModalProps {
  stops: Stop[];
  matchingStops: Stop[];
  title: string;
  selectedStop: string;
  matchingLabel: string;
  /** When provided, shown as the section header for matching stops instead of matchingLabel. */
  parentStation?: string;
  allLabel: string;
  closeLabel: string;
  noStopsLabel: string;
  onSelect: (name: string, address: string, surcharge: number) => void;
  onClose: () => void;
}

function SubStopPickerModal({ stops, matchingStops, title, selectedStop, matchingLabel, parentStation, allLabel, closeLabel, noStopsLabel, onSelect, onClose }: SubStopPickerModalProps) {
  // Deduplicate the "all stops" list so matching stops are not shown twice.
  const matchingIds = useMemo(() => new Set(matchingStops.map(s => s.id)), [matchingStops]);
  const otherStops = useMemo(() => stops.filter(s => !matchingIds.has(s.id)), [stops, matchingIds]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-daiichi-red" />
            <h3 className="font-bold text-sm text-gray-800">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-3 space-y-3">
          {stops.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{noStopsLabel}</p>
          ) : (
            <>
              {/* Matching stops section – shown when user typed a query before confirming terminal */}
              {matchingStops.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-daiichi-red uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <span>{parentStation ? '🏢' : '🎯'}</span> {parentStation || matchingLabel}
                  </p>
                  <div className="space-y-1 pl-2">
                    {matchingStops.map(stop => (
                      <button
                        key={stop.id}
                        type="button"
                        onClick={() => onSelect(stop.name, stop.address || '', stop.surcharge || 0)}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left border transition-all",
                          selectedStop === stop.name
                            ? "bg-daiichi-red text-white border-daiichi-red"
                            : "bg-red-50 border-red-100 hover:bg-daiichi-red hover:text-white hover:border-daiichi-red"
                        )}
                      >
                        <MapPin size={13} className="flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-words">{stop.name}</p>
                        </div>
                        {selectedStop === stop.name && <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All other stops */}
              {otherStops.length > 0 && (
                <div>
                  {matchingStops.length > 0 ? (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{allLabel}</p>
                  ) : parentStation ? (
                    <p className="text-[10px] font-bold text-daiichi-red uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span>🏢</span> {parentStation}
                    </p>
                  ) : null}
                  <div className="space-y-1 pl-2">
                    {otherStops.map(stop => (
                      <button
                        key={stop.id}
                        type="button"
                        onClick={() => onSelect(stop.name, stop.address || '', stop.surcharge || 0)}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left border transition-all",
                          selectedStop === stop.name
                            ? "bg-daiichi-red text-white border-daiichi-red"
                            : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                        )}
                      >
                        <MapPin size={13} className={cn("flex-shrink-0 mt-0.5", selectedStop === stop.name ? "text-white" : "text-gray-400")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-words">{stop.name}</p>
                        </div>
                        {selectedStop === stop.name && <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-600 transition-colors">
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  /** Called once a terminal is confirmed (e.g. to auto-focus the next field). */
  onConfirmed?: () => void;
  /** Label for the pickup/dropoff stop suggestion chips, e.g. "Gợi ý điểm đón". */
  pickupSuggestionLabel?: string;
  /** Currently pre-selected pickup/dropoff stop name. */
  selectedStop?: string;
  /** Called when user taps a pickup/dropoff stop suggestion chip. */
  onPickupStopSelect?: (name: string, address: string, surcharge: number) => void;
  /** Prompt text shown on the sub-stop picker button when nothing is selected yet. */
  selectStopPrompt?: string;
  /** Label for the "matching" section inside the sub-stop picker. */
  stopPickerMatchingLabel?: string;
  /** Label for the "all stops" section inside the sub-stop picker. */
  stopPickerAllLabel?: string;
  /** Label for the close button inside the sub-stop picker. */
  stopPickerCloseLabel?: string;
  /** Label shown when there are no sub-stops in the picker. */
  stopPickerNoStopsLabel?: string;
}

/** Imperative handle exposed by StopSearchInput via forwardRef. */
interface StopSearchInputHandle {
  focus(): void;
}

// Delay (ms) between input blur and checking the selection state, ensuring that
// onMouseDown on a suggestion button fires and updates state before we evaluate.
const BLUR_DEBOUNCE_MS = 150;

/**
 * Renders a location name so that any parenthetical note "(…)" is displayed
 * in a noticeably smaller font, making the primary name stand out while the
 * supplementary note remains visible but unobtrusive.
 * The underlying string value is never modified, so search/booking logic is unaffected.
 */
function renderNameWithParens(name: string): React.ReactNode {
  const parenIdx = name.indexOf('(');
  if (parenIdx === -1) return name;
  const before = name.slice(0, parenIdx);
  const paren = name.slice(parenIdx);
  return (
    <>
      {before}
      <span className="text-[10px] font-normal opacity-70">{paren}</span>
    </>
  );
}

const StopSearchInput = React.forwardRef<StopSearchInputHandle, StopSearchInputProps>(
function StopSearchInput({ value, terminalValue, stops, placeholder, nearestHint, mustSelectError, onChange, onConfirmed, pickupSuggestionLabel, selectedStop, onPickupStopSelect, selectStopPrompt, stopPickerMatchingLabel, stopPickerAllLabel, stopPickerCloseLabel, stopPickerNoStopsLabel }: StopSearchInputProps, ref) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMustSelect, setShowMustSelect] = useState(false);
  const [showSubStopPicker, setShowSubStopPicker] = useState(false);
  // Remember what the user typed just before they confirmed a terminal, so we can
  // pre-filter sub-stops to only the ones that are relevant to their search query.
  const [lastTypedQuery, setLastTypedQuery] = useState('');
  // When a terminal with child stops is confirmed, we defer onConfirmed until the
  // sub-stop picker is dismissed (either by selection or by pressing Close).
  const pendingOnConfirmedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to always access the latest terminalValue inside async callbacks
  const terminalValueRef = useRef(terminalValue);
  terminalValueRef.current = terminalValue;
  // Refs for imperative handle (always latest value/onChange without stale closures)
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Expose a focus() method that auto-switches back to edit mode when needed.
  useImperativeHandle(ref, () => ({
    focus() {
      if (terminalValueRef.current) {
        // Currently in confirmed display mode – clear the terminal to re-enter edit mode.
        onChangeRef.current(valueRef.current, '');
        setShowDropdown(true);
        setShowMustSelect(false);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }), []);

  // Child stops (pickup / dropoff suggestions) for the confirmed terminal.
  const pickupStops = useMemo(() => {
    if (!terminalValue) return [];
    const terminal = stops.find(s => s.name === terminalValue && s.type === 'TERMINAL');
    if (!terminal) return [];
    return stops
      .filter(s => s.terminalId === terminal.id)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  }, [terminalValue, stops]);

  // Child stops that match what the user typed before selecting the terminal.
  // When lastTypedQuery is set, this is the pre-filtered list shown at the top of the picker.
  const matchingPickupStops = useMemo(() => {
    if (!lastTypedQuery.trim() || !pickupStops.length) return [];
    return pickupStops.filter(stop => {
      const nameScore = matchScore(stop.name, lastTypedQuery);
      const addressScore = stop.address ? matchScore(stop.address, lastTypedQuery) : 0;
      return Math.max(nameScore, addressScore) > 0;
    });
  }, [lastTypedQuery, pickupStops]);

  interface Suggestion { stop: Stop; terminal: Stop | undefined }

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!value.trim()) return [];
    // Use only the user-typed text for matching. Stop suggestions are already
    // pre-filtered by vehicle type via `filteredStops` (computed in the parent),
    // so appending a vehicle-type suffix here is unnecessary and would break
    // search for terminals whose names do not contain any vehicle-type tokens.
    const effectiveSearch = value;
    // Use a Map keyed by terminal id so each parent terminal appears at most once,
    // keeping the highest match score found (via direct name match or via a child stop).
    const resultMap = new Map<string, { sug: Suggestion; score: number }>();

    // Build a lookup of id → terminal for resolving child stops to their parent.
    const terminalMap = new Map<string, Stop>();
    stops.forEach(stop => {
      if (stop.type === 'TERMINAL') terminalMap.set(stop.id, stop);
    });

    const addTerminal = (terminal: Stop, score: number) => {
      const existing = resultMap.get(terminal.id);
      if (!existing || score > existing.score) {
        resultMap.set(terminal.id, { sug: { stop: terminal, terminal }, score });
      }
    };

    stops.forEach(stop => {
      if (stop.type === 'TERMINAL') {
        // Direct match on terminal name
        const score = matchScore(stop.name, effectiveSearch);
        if (score > 0) addTerminal(stop, score);
      } else {
        // Child stop (type === 'STOP' or legacy): search by name AND address,
        // then surface the parent TERMINAL so only terminals appear in the list.
        const nameScore = matchScore(stop.name, effectiveSearch);
        // Only score the address if the name didn't already produce an exact match.
        const addressScore = nameScore < 100 && stop.address ? matchScore(stop.address, effectiveSearch) : 0;
        const score = Math.max(nameScore, addressScore);
        if (score > 0 && stop.terminalId) {
          const terminal = terminalMap.get(stop.terminalId);
          if (terminal) addTerminal(terminal, score);
        }
      }
    });

    const arr = Array.from(resultMap.values());
    // Sort: match score first (descending – best match on top), then priority as tiebreaker
    // (ascending – lower priority number = more important terminal) so that when two
    // terminals score equally the one marked as higher priority surfaces first.
    arr.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPriority = a.sug.stop.priority && a.sug.stop.priority > 0 ? a.sug.stop.priority : undefined;
      const bPriority = b.sug.stop.priority && b.sug.stop.priority > 0 ? b.sug.stop.priority : undefined;
      const aHas = aPriority !== undefined;
      const bHas = bPriority !== undefined;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) return aPriority! - bPriority!;
      return 0;
    });
    return arr.slice(0, 8).map(r => r.sug);
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
    // Save what the user typed so we can pre-filter sub-stops to matching ones.
    setLastTypedQuery(value);
    onChange(terminalName, terminalName);
    setShowDropdown(false);
    setShowMustSelect(false);
    // If this terminal has child (pickup/dropoff) stops, auto-open the picker
    // immediately so the user can select one right away, and defer onConfirmed
    // until after the picker is dismissed.
    if (onPickupStopSelect) {
      const selectedTerminal = stops.find(s => s.name === terminalName && s.type === 'TERMINAL');
      const hasChildStops = selectedTerminal ? stops.some(s => s.terminalId === selectedTerminal.id) : false;
      if (hasChildStops) {
        pendingOnConfirmedRef.current = true;
        setShowSubStopPicker(true);
        return;
      }
    }
    onConfirmed?.();
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
    setLastTypedQuery('');
    setShowSubStopPicker(false);
    pendingOnConfirmedRef.current = false;
    setShowDropdown(true);
    setShowMustSelect(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin
        className={cn("absolute left-4 z-10 text-gray-400", isConfirmed ? "top-2.5 sm:top-4" : "top-1/2 -translate-y-1/2")}
        size={18}
      />
      {isConfirmed ? (
        // Display mode: text wraps for long station names, click/keyboard to re-edit
        <div
          role="button"
          tabIndex={0}
          aria-label={`${value} – nhấn để chỉnh sửa`}
          className="w-full pl-12 pr-14 py-2.5 sm:py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium text-gray-800 line-clamp-2 leading-snug min-h-[44px] sm:min-h-[56px] cursor-pointer"
          onClick={handleEditMode}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEditMode(); } }}
        >
          {renderNameWithParens(value)}
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
            "w-full pl-12 pr-8 py-2.5 sm:py-4 bg-gray-50 border rounded-2xl focus:ring-2 focus:outline-none text-sm font-medium text-gray-800",
            showMustSelect
              ? "border-daiichi-red focus:ring-daiichi-red/10"
              : "border-gray-100 focus:ring-daiichi-red/10"
          )}
        />
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange('', ''); setShowDropdown(false); setShowMustSelect(false); setLastTypedQuery(''); setShowSubStopPicker(false); pendingOnConfirmedRef.current = false; }}
          className={cn("absolute right-3 text-gray-300 hover:text-gray-500 transition-colors", isConfirmed ? "top-2.5 sm:top-4" : "top-1/2 -translate-y-1/2")}
          aria-label="Clear"
        >
          <X size={14} />
        </button>
      )}
      {terminalValue && !showDropdown && (
        <span className="absolute right-8 top-2.5 sm:top-4 text-daiichi-red" title={terminalValue}>
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
                <p className="text-sm font-medium text-gray-800 break-words">{renderNameWithParens(item.stop.name)}</p>
                {item.stop.type !== 'TERMINAL' && item.terminal && (
                  <p className="text-[11px] text-daiichi-red font-semibold break-words">🏢 {item.terminal.name}</p>
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
      {/* Sub-stop picker trigger button shown below the confirmed input */}
      {isConfirmed && pickupStops.length > 0 && onPickupStopSelect && (
        <div className="mt-1.5 ml-5 mr-1">
          <button
            type="button"
            onClick={() => setShowSubStopPicker(true)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all",
              selectedStop
                ? "bg-gray-50 border-gray-200 text-gray-800"
                : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-700"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={13} className={cn("flex-shrink-0", selectedStop ? "text-gray-500" : "text-gray-400")} />
              <span className="truncate text-left text-xs">
                {selectedStop || selectStopPrompt || pickupSuggestionLabel}
              </span>
            </div>
            {selectedStop ? (
              <CheckCircle2 size={13} className="flex-shrink-0 text-gray-500" />
            ) : (
              <ChevronDown size={13} className="flex-shrink-0" />
            )}
          </button>
        </div>
      )}
      {/* Sub-stop picker modal – rendered as a fixed overlay so it floats above all other content */}
      {showSubStopPicker && pickupStops.length > 0 && onPickupStopSelect && (
        <SubStopPickerModal
          stops={pickupStops}
          matchingStops={matchingPickupStops}
          title={selectStopPrompt || pickupSuggestionLabel || 'Chọn điểm'}
          selectedStop={selectedStop || ''}
          matchingLabel={stopPickerMatchingLabel || 'Kết quả liên quan'}
          parentStation={terminalValue || undefined}
          allLabel={stopPickerAllLabel || 'Tất cả điểm dừng'}
          closeLabel={stopPickerCloseLabel || 'Đóng'}
          noStopsLabel={stopPickerNoStopsLabel || 'Không có điểm dừng'}
          onSelect={(name, address, surcharge) => {
            onPickupStopSelect(name, address, surcharge);
            setShowSubStopPicker(false);
            if (pendingOnConfirmedRef.current) {
              pendingOnConfirmedRef.current = false;
              onConfirmed?.();
            }
          }}
          onClose={() => {
            setShowSubStopPicker(false);
            if (pendingOnConfirmedRef.current) {
              pendingOnConfirmedRef.current = false;
              onConfirmed?.();
            }
          }}
        />
      )}
    </div>
  );
}
);


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
  setVehicleTypeFilter: (v: string) => void;
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
  // Pre-fill pickup/dropoff from the search form → flows into SeatMappingPage
  pickupAddress: string;
  dropoffAddress: string;
  setPickupAddress: (v: string) => void;
  setDropoffAddress: (v: string) => void;
  setPickupAddressSurcharge: (v: number) => void;
  setDropoffAddressSurcharge: (v: number) => void;
  setPickupStopAddress: (v: string) => void;
  setDropoffStopAddress: (v: string) => void;
  // Helpers
  compareTripDateTime: (a: { date?: string; time?: string }, b: { date?: string; time?: string }) => number;
  formatTripDateDisplay: (dateStr: string) => string;
}

// Vehicle type options shown in the search form selector.
const VEHICLE_TYPES = [
  'Limousine 11 ghế',
  'Xe điện 7 chỗ',
  'Bus 45 chỗ',
  'Xe cabin 24 phòng',
  'Xe giường nằm Khách sạn',
  'Xe giường nằm',
] as const;

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
  setVehicleTypeFilter,
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
  pickupAddress,
  dropoffAddress,
  setPickupAddress,
  setDropoffAddress,
  setPickupAddressSurcharge,
  setDropoffAddressSurcharge,
  setPickupStopAddress,
  setDropoffStopAddress,
}: BookTicketPageProps) {
  const t = TRANSLATIONS[language];
  const { toasts, showToast, dismissToast } = useToast();

  // Track mobile viewport (< 640px = Tailwind's sm: breakpoint) for responsive placeholder text.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => setIsMobile(window.innerWidth < 640), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(resizeTimer); };
  }, []);

  // Segment-based fare lookup: map from routeId → { price, agentPrice }
  // Updated whenever the customer's searchFrom / searchTo changes.
  const [segmentFares, setSegmentFares] = useState<Map<string, { price: number; agentPrice?: number }>>(new Map());
  // True once the async fare check for the current from/to pair has completed.
  // Used to filter out trips whose route has no fare configuration for the searched segment.
  const [segmentFaresLoaded, setSegmentFaresLoaded] = useState(false);
  const segmentFareFetchRef = useRef(0);
  // Ref to the "To" StopSearchInput – used to auto-focus it when "From" is confirmed.
  const toStopRef = useRef<StopSearchInputHandle>(null);

  // Handler for the "From" stop input: clears pre-selected pickup when terminal is cleared.
  const handleFromChange = (text: string, terminal: string) => {
    setSearchFrom(text);
    setSearchStationFrom(terminal);
    if (!terminal) {
      setPickupAddress('');
      setPickupStopAddress('');
      setPickupAddressSurcharge(0);
    }
  };

  // Handler for the "To" stop input: clears pre-selected dropoff when terminal is cleared.
  const handleToChange = (text: string, terminal: string) => {
    setSearchTo(text);
    setSearchStationTo(terminal);
    if (!terminal) {
      setDropoffAddress('');
      setDropoffStopAddress('');
      setDropoffAddressSurcharge(0);
    }
  };

  // Swap origin and destination (and their respective sub-stop selections).
  const handleSwap = () => {
    const prevFrom = searchFrom;
    const prevStationFrom = searchStationFrom;
    const prevPickup = pickupAddress;
    setSearchFrom(searchTo);
    setSearchStationFrom(searchStationTo);
    setPickupAddress(dropoffAddress);
    setPickupStopAddress('');
    setPickupAddressSurcharge(0);
    setSearchTo(prevFrom);
    setSearchStationTo(prevStationFrom);
    setDropoffAddress(prevPickup);
    setDropoffStopAddress('');
    setDropoffAddressSurcharge(0);
  };

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
          if (!route) return null;
          // A route is "direct" when it has no actual intermediate stops.
          // New-format routes always include synthetic __departure__ / __arrival__ entries
          // in routeStops, so we must exclude those when deciding whether real stops exist.
          const hasIntermediateStops = (route.routeStops || []).some(
            s => s.stopId !== '__departure__' && s.stopId !== '__arrival__',
          );
          if (!hasIntermediateStops) {
            // Direct route (no intermediate stops): the full route is the only segment.
            // Return the base route price so this route passes the segment-fare filter in filterTrip.
            return { routeId: route.id, price: route.price, agentPrice: route.agentPrice };
          }

          // Resolve stop IDs (prefer route-embedded stops, fall back to global stops).
          // Use exact match first; then bidirectional fuzzy match to handle cases where
          // the terminal name in the stops collection is longer than route.departurePoint
          // (e.g. stop name = "Hà Nội (đón trả Phố Cổ)" vs departurePoint = "Hà Nội").
          const fromRouteStop = route.routeStops.find(rs => rs.stopName === effectiveFrom)
            ?? route.routeStops.find(rs => matchesSearch(rs.stopName, effectiveFrom) || matchesSearch(effectiveFrom, rs.stopName))
            // Fallback: effectiveFrom matches the route's departure point – use __departure__ ID.
            // The order value is not used below (routeStops is only passed to getFare when
            // both IDs are confirmed to be present in the actual route.routeStops array).
            ?? (route.departurePoint && (matchesSearch(effectiveFrom, route.departurePoint) || matchesSearch(route.departurePoint, effectiveFrom))
              ? { stopId: '__departure__', stopName: route.departurePoint, order: 0 }
              : undefined);
          const toRouteStop = route.routeStops.find(rs => rs.stopName === effectiveTo)
            ?? route.routeStops.find(rs => matchesSearch(rs.stopName, effectiveTo) || matchesSearch(effectiveTo, rs.stopName))
            // Fallback: effectiveTo matches the route's arrival point – use __arrival__ ID.
            ?? (route.arrivalPoint && (matchesSearch(effectiveTo, route.arrivalPoint) || matchesSearch(route.arrivalPoint, effectiveTo))
              ? { stopId: '__arrival__', stopName: route.arrivalPoint, order: 9999 }
              : undefined);
          const fromGlobalStop = stops.find(s => s.name === effectiveFrom)
            ?? stops.find(s => matchesSearch(s.name, effectiveFrom));
          const toGlobalStop = stops.find(s => s.name === effectiveTo)
            ?? stops.find(s => matchesSearch(s.name, effectiveTo));

          const fromStopId = fromRouteStop?.stopId || fromGlobalStop?.id || '';
          const toStopId = toRouteStop?.stopId || toGlobalStop?.id || '';

          if (!fromStopId || !toStopId) return null;

          // Only pass routeStops to getFare if both stop IDs are actually present in
          // route.routeStops (avoids STOP_NOT_IN_ROUTE errors for old-format routes that
          // don't include __departure__/__arrival__ entries, and for cases where we
          // synthesized a stopId from the departure/arrival point name above).
          // When routeStops is undefined, getFare skips ordering validation and performs
          // a direct Firestore query for the (fromStopId, toStopId) pair.
          const fromInRouteStops = route.routeStops.some(rs => rs.stopId === fromStopId);
          const toInRouteStops = route.routeStops.some(rs => rs.stopId === toStopId);

          try {
            const fare = await transportService.getFare({
              routeId: route.id,
              fromStopId,
              toStopId,
              routeStops: fromInRouteStops && toInRouteStops ? route.routeStops : undefined,
              stops,
            });
            return { routeId: route.id, price: fare.price, agentPrice: fare.agentPrice };
          } catch (err) {
            // When no fare is explicitly configured for this exact segment but the
            // segment itself is valid (stops are in the correct order within the route),
            // fall back to the route's base price so trips are still shown to the user.
            // Only suppress the trip when the segment is genuinely invalid (reversed
            // direction, unknown stops, etc.) or a database error occurred.
            if (err instanceof FareError && err.code === 'FARE_NOT_CONFIGURED') {
              return { routeId: route.id, price: route.price, agentPrice: route.agentPrice };
            }
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
      const fromIdx = orderedStops.findIndex(name =>
        matchesSearch(name as string, effectiveFrom) || matchesSearch(effectiveFrom, name as string));
      if (fromIdx === -1) return false;
      const toIdx = orderedStops.findIndex(name =>
        matchesSearch(name as string, effectiveTo) || matchesSearch(effectiveTo, name as string));
      return toIdx !== -1 && fromIdx < toIdx;
    });
  }, [searchFrom, searchTo, tripType, roundTripPhase, routes]);

  // When a vehicle type filter is active, narrow the stop suggestions to only terminals /
  // child stops that belong to routes served by that vehicle type.
  const filteredStops = useMemo<Stop[]>(() => {
    if (!vehicleTypeFilter) return stops;

    // Primary approach: filter by the terminal's vehicleTypes field (set in stop management).
    // If any terminal has vehicleTypes configured, use this direct approach.
    const terminalsWithType = stops.filter(s => s.type === 'TERMINAL' && s.vehicleTypes);
    if (terminalsWithType.length > 0) {
      const allowedTerminalIds = new Set<string>(
        terminalsWithType
          .filter(t => matchesSearch(t.vehicleTypes!, vehicleTypeFilter))
          .map(t => t.id)
      );
      return stops.filter(stop => {
        if (stop.type === 'TERMINAL') return allowedTerminalIds.has(stop.id);
        return stop.terminalId ? allowedTerminalIds.has(stop.terminalId) : false;
      });
    }

    // Fallback (legacy): filter via vehicle → trips → routes → stops.
    // Collect license plates of vehicles matching the selected type
    const matchingPlates = new Set(
      vehicles.filter(v => v.type === vehicleTypeFilter).map(v => v.licensePlate)
    );
    // Collect route names from trips that use those vehicles
    const filteredRouteNames = new Set(
      trips
        .filter(trip => matchingPlates.has(trip.licensePlate))
        .map(trip => trip.route)
        .filter(Boolean)
    );
    if (filteredRouteNames.size === 0) return stops;
    // Collect all stop names referenced by those routes
    const allowedStopNames = new Set<string>();
    routes
      .filter(r => filteredRouteNames.has(r.name))
      .forEach(r => {
        if (r.departurePoint) allowedStopNames.add(r.departurePoint);
        if (r.arrivalPoint) allowedStopNames.add(r.arrivalPoint);
        (r.routeStops || []).forEach(rs => {
          if (rs.stopName) allowedStopNames.add(rs.stopName);
        });
      });
    // Build set of terminal IDs whose name is allowed
    const allowedTerminalIds = new Set<string>();
    stops.forEach(stop => {
      if (stop.type === 'TERMINAL' && stop.id && allowedStopNames.has(stop.name)) {
        allowedTerminalIds.add(stop.id);
      }
    });
    return stops.filter(stop => {
      if (stop.type === 'TERMINAL') return allowedStopNames.has(stop.name);
      // Child stops without a valid terminalId cannot be linked to a filtered terminal,
      // so they are excluded to avoid surfacing unresolvable suggestions.
      return stop.terminalId ? allowedTerminalIds.has(stop.terminalId) : false;
    });
  }, [vehicleTypeFilter, stops, vehicles, trips, routes]);

  const filterTrip = (trip: Trip, includeDate: boolean) => {
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    const effectiveFrom = isReturnPhase ? searchTo : searchFrom;
    const effectiveTo = isReturnPhase ? searchFrom : searchTo;
    const effectiveDate = isReturnPhase ? searchReturnDate : searchDate;

    if (trip.status !== TripStatus.WAITING) return false;
    const tripVehicle = bookTicketSearch
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
          const fromIdx = orderedStops.findIndex(name =>
            matchesSearch(name, effectiveFrom) || matchesSearch(effectiveFrom, name));
          if (fromIdx === -1) return false;
          if (effectiveTo) {
            const toIdx = orderedStops.findIndex(name =>
              matchesSearch(name, effectiveTo) || matchesSearch(effectiveTo, name));
            if (toIdx === -1 || fromIdx >= toIdx) return false;
          }
        } else {
          const toIdx = orderedStops.findIndex(name =>
            matchesSearch(name, effectiveTo) || matchesSearch(effectiveTo, name));
          if (toIdx === -1) return false;
        }
      } else {
        const fallbackText = trip.route || '';
        if (effectiveFrom && !matchesSearch(fallbackText, effectiveFrom)) return false;
        if (effectiveTo && !matchesSearch(fallbackText, effectiveTo)) return false;
      }
    }
    if (includeDate && effectiveDate && trip.date && trip.date !== effectiveDate) return false;
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

  // Returns true when the given terminal has child (pickup/dropoff) sub-stops configured.
  const terminalHasSubStops = (terminalName: string): boolean => {
    if (!terminalName) return false;
    const terminal = stops.find(s => s.name === terminalName && s.type === 'TERMINAL');
    if (!terminal) return false;
    return stops.some(s => s.terminalId === terminal.id);
  };

  // Returns true when the terminal is ready to search: either it has no sub-stops,
  // or the user has already selected one.
  const isTerminalReadyForSearch = (terminalName: string, selectedAddress: string): boolean =>
    !terminalName || !terminalHasSubStops(terminalName) || !!selectedAddress;

  // The search button is only enabled once all required stops are selected.
  // If a terminal has sub-stops (pickup/dropoff points), one must be chosen before searching.
  const isSearchReady =
    isTerminalReadyForSearch(searchStationFrom, pickupAddress) &&
    isTerminalReadyForSearch(searchStationTo, dropoffAddress);

  const handleSearch = () => {
    // Block search if the user typed text in a stop field but did not confirm a selection
    const fromUnconfirmed = searchFrom.trim() && !searchStationFrom;
    const toUnconfirmed = searchTo.trim() && !searchStationTo;
    if (fromUnconfirmed || toUnconfirmed) {
      showToast(t.stop_search_must_select, 'error');
      return;
    }
    // Block search if a terminal has pickup/dropoff stops but none has been selected yet
    if (!isTerminalReadyForSearch(searchStationFrom, pickupAddress)) {
      showToast(t.select_pickup_point || 'Vui lòng chọn điểm đón', 'error');
      return;
    }
    if (!isTerminalReadyForSearch(searchStationTo, dropoffAddress)) {
      showToast(t.select_dropoff_point || 'Vui lòng chọn điểm trả', 'error');
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
            <div className="px-3 pb-2.5 border-t border-gray-100 pt-1.5 mt-0.5">
              <div className="flex items-stretch gap-2 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0 mt-0.5" aria-hidden="true">
                  <div className="w-1.5 h-1.5 rounded-full bg-daiichi-red" />
                  <div className="w-px flex-1 bg-gray-200 my-0.5" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span
                    className="text-[10px] font-semibold text-gray-700 leading-tight line-clamp-1"
                    aria-label={`${language === 'vi' ? 'Điểm đi' : language === 'ja' ? '出発地' : 'From'}: ${effectiveFrom || '—'}`}
                  >
                    {effectiveFrom || '—'}
                  </span>
                  <span
                    className="text-[10px] font-medium text-gray-500 leading-tight line-clamp-1"
                    aria-label={`${language === 'vi' ? 'Điểm đến' : language === 'ja' ? '目的地' : 'To'}: ${effectiveTo || '—'}`}
                  >
                    {effectiveTo || '—'}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-3 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-2xl font-bold truncate">{t.search_title}</h2>
          <div className="flex-shrink-0 flex bg-gray-100 p-0.5 sm:p-1 rounded-xl">
            {(['ONE_WAY', 'ROUND_TRIP'] as const).map((type) => (
              <button 
                key={type}
                onClick={() => setTripType(type)}
                className={cn(
                  "px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap",
                  tripType === type ? "bg-white text-daiichi-red shadow-sm" : "text-gray-500"
                )}
              >
                {type === 'ONE_WAY' ? t.trip_one_way : t.trip_round_trip}
              </button>
            ))}
          </div>
        </div>
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4", tripType === 'ROUND_TRIP' ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {/* FROM + swap button + TO in a combined cell spanning 2 columns on large screens */}
          <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-start gap-2">
            <div className="flex-1 min-w-0">
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.from}</label>
              <div className="sm:mt-1">
                <StopSearchInput
                  value={searchFrom}
                  terminalValue={searchStationFrom}
                  stops={filteredStops}
                  placeholder={isMobile ? t.stop_search_from_placeholder_mobile : (t.stop_search_from_placeholder || t.from)}
                  nearestHint={t.stop_search_nearest_hint}
                  mustSelectError={t.stop_search_must_select}
                  onChange={handleFromChange}
                  onConfirmed={() => toStopRef.current?.focus()}
                  pickupSuggestionLabel={t.pickup_stop_suggestion}
                  selectedStop={pickupAddress}
                  onPickupStopSelect={(name, address, surcharge) => { setPickupAddress(name); setPickupStopAddress(address); setPickupAddressSurcharge(surcharge); }}
                  selectStopPrompt={t.select_pickup_point}
                  stopPickerMatchingLabel={t.stop_picker_matching}
                  stopPickerAllLabel={t.stop_picker_all}
                  stopPickerCloseLabel={t.stop_picker_close}
                  stopPickerNoStopsLabel={t.stop_picker_no_stops}
                />
              </div>
            </div>
            {/* Swap button */}
            <button
              type="button"
              onClick={handleSwap}
              title={t.swap_from_to || 'Đổi điểm đi và điểm đến'}
              className="flex-shrink-0 self-center sm:self-start sm:mt-0 w-9 h-9 flex items-center justify-center rounded-full border-2 border-daiichi-red/60 bg-white text-daiichi-red shadow hover:border-daiichi-red hover:bg-daiichi-red/10 transition-all"
            >
              <ArrowUpDown size={18} strokeWidth={2.5} />
            </button>
            <div className="flex-1 min-w-0">
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.to}</label>
              <div className="sm:mt-1">
                <StopSearchInput
                  ref={toStopRef}
                  value={searchTo}
                  terminalValue={searchStationTo}
                  stops={filteredStops}
                  placeholder={isMobile ? t.stop_search_to_placeholder_mobile : (t.stop_search_to_placeholder || t.to)}
                  nearestHint={t.stop_search_nearest_hint}
                  mustSelectError={t.stop_search_must_select}
                  onChange={handleToChange}
                  pickupSuggestionLabel={t.dropoff_stop_suggestion}
                  selectedStop={dropoffAddress}
                  onPickupStopSelect={(name, address, surcharge) => { setDropoffAddress(name); setDropoffStopAddress(address); setDropoffAddressSurcharge(surcharge); }}
                  selectStopPrompt={t.select_dropoff_point}
                  stopPickerMatchingLabel={t.stop_picker_matching}
                  stopPickerAllLabel={t.stop_picker_all}
                  stopPickerCloseLabel={t.stop_picker_close}
                  stopPickerNoStopsLabel={t.stop_picker_no_stops}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.departure_date}</label>
            <div className="relative sm:mt-1">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="date" value={searchDate} min={getLocalDateString(0)} onChange={e => setSearchDate(e.target.value)} className="w-full pl-12 pr-4 py-2.5 sm:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
            </div>
          </div>
          {tripType === 'ROUND_TRIP' && (
            <div>
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.return_date}</label>
              <div className="relative sm:mt-1">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="date" value={searchReturnDate} min={searchDate || getLocalDateString(0)} onChange={e => setSearchReturnDate(e.target.value)} className="w-full pl-12 pr-4 py-2.5 sm:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-daiichi-red/10" />
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
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 mt-2 sm:mt-4">
          <div className="flex-1 sm:flex-none grid grid-cols-2 gap-2 sm:gap-4 sm:mt-4 sm:w-64">
            <div>
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1 truncate">{t.num_adults}</label>
              <div className="relative sm:mt-1 flex items-center bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSearchAdults(v => Math.max(1, v - 1))}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >−</button>
                <div className="w-full flex flex-col items-center px-8 sm:px-10 py-2 sm:py-3">
                  <span className="text-[10px] sm:hidden font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{t.num_adults}</span>
                  <input
                    type="number"
                    min="1"
                    value={searchAdults}
                    onChange={e => setSearchAdults(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center bg-transparent focus:outline-none font-bold text-gray-700 text-sm leading-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchAdults(v => v + 1)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >+</button>
              </div>
            </div>
            <div>
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1 truncate">{t.num_children}</label>
              <div className="relative sm:mt-1 flex items-center bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSearchChildren(v => Math.max(0, v - 1))}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >−</button>
                <div className="w-full flex flex-col items-center px-8 sm:px-10 py-2 sm:py-3">
                  <span className="text-[10px] sm:hidden font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{t.num_children}</span>
                  <input
                    type="number"
                    min="0"
                    value={searchChildren === 0 ? '' : searchChildren}
                    onChange={e => setSearchChildren(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full text-center bg-transparent focus:outline-none font-bold text-gray-700 text-sm leading-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchChildren(v => v + 1)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >+</button>
              </div>
            </div>
          </div>
          {/* Search button – full width on mobile, auto on sm+ */}
          <div className="sm:shrink-0 sm:ml-auto sm:flex sm:mt-4">
            <button
              onClick={handleSearch}
              disabled={!isSearchReady}
              className={cn(
                "w-full sm:w-auto px-4 sm:px-8 py-3 sm:py-4 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap",
                isSearchReady
                  ? "bg-daiichi-red shadow-daiichi-red/20 hover:scale-[1.02]"
                  : "bg-gray-300 shadow-gray-300/20 cursor-not-allowed"
              )}
            >
              <Search size={18} />
              <span>{t.search_btn}</span>
            </button>
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
