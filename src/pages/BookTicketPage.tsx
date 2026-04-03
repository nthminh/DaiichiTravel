import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Bus, Users, Calendar, MapPin, Search, Clock, X, CheckCircle2, AlertTriangle, Phone, Gift, ChevronDown, ArrowUpDown, Heart, ChevronRight, Info, ZoomIn, SlidersHorizontal, DatabaseZap, Loader2 as LoaderIcon } from 'lucide-react'
import { cn, getLocalDateString } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole } from '../App'
import { SeatStatus, TripStatus, Trip, Route, Stop, TripAddon, Vehicle, RouteSurcharge } from '../types'
import { matchesSearch, matchScore } from '../lib/searchUtils'
import { parseDurationToMinutes } from '../lib/routeUtils'
import { motion } from 'motion/react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ToastContainer'
import { transportService } from '../services/transportService'
import { formatBookingDate } from '../lib/vnDate'

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

interface CompactStopSelectorProps {
  stops: Stop[];
  selectedStop: Stop | null;
  onSelect: (stop: Stop | null) => void;
  placeholder: string;
  emptyLabel: string;
  theme: 'pickup' | 'dropoff';
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
                            : "bg-pink-50 border-pink-200 hover:bg-daiichi-red hover:text-white hover:border-daiichi-red"
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
                            : "bg-white border-gray-200 hover:bg-gray-100"
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

function CompactStopSelector({ stops, selectedStop, onSelect, placeholder, emptyLabel, theme }: CompactStopSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const isPickup = theme === 'pickup';
  const filteredStops = useMemo(
    () => stops.filter(
      stop => !filter || matchesSearch(stop.name, filter) || (stop.address && matchesSearch(stop.address, filter)),
    ),
    [filter, stops],
  );

  const resetAndClose = () => {
    setFilter('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
          selectedStop
            ? isPickup
              ? "bg-red-50 border-daiichi-red/30"
              : "bg-blue-50 border-blue-300/40"
            : "bg-gray-50 border-gray-200 hover:border-gray-300",
        )}
      >
        <MapPin size={14} className={cn("flex-shrink-0", selectedStop ? (isPickup ? "text-daiichi-red" : "text-blue-500") : "text-gray-400")} />
        <div className="flex-1 min-w-0">
          {selectedStop ? (
            <>
              <p className={cn("text-xs font-semibold break-words", isPickup ? "text-daiichi-red" : "text-blue-600")}>{selectedStop.name}</p>
              {selectedStop.address && <p className="text-[10px] text-gray-500 mt-0.5 break-words">{selectedStop.address}</p>}
              {(selectedStop.surcharge || 0) > 0 && (
                <p className="text-[10px] font-bold text-green-600 mt-0.5">+{(selectedStop.surcharge || 0).toLocaleString()}đ</p>
              )}
            </>
          ) : (
            <p className="text-xs font-semibold text-gray-500">{emptyLabel}</p>
          )}
        </div>
        <ChevronDown size={16} className={cn("flex-shrink-0 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="rounded-2xl border border-gray-200 bg-white p-2 space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={placeholder}
              className={cn(
                "w-full pl-8 pr-8 py-2 text-xs border rounded-xl bg-gray-50 focus:outline-none focus:bg-white transition-all",
                isPickup ? "border-gray-200 focus:border-daiichi-red" : "border-gray-200 focus:border-blue-400",
              )}
            />
            {filter && (
              <button type="button" onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={11} />
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onSelect(null); resetAndClose(); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left border text-xs transition-all",
                !selectedStop
                  ? isPickup
                    ? "bg-daiichi-red/10 border-daiichi-red text-daiichi-red font-bold"
                    : "bg-blue-50 border-blue-400 text-blue-600 font-bold"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              <X size={11} className="flex-shrink-0" />
              {emptyLabel}
            </button>

            {filteredStops.map(stop => (
              <button
                key={stop.id}
                type="button"
                onClick={() => { onSelect(stop); resetAndClose(); }}
                className={cn(
                  "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left border transition-all",
                  selectedStop?.id === stop.id
                    ? isPickup
                      ? "bg-daiichi-red text-white border-daiichi-red"
                      : "bg-blue-500 text-white border-blue-500"
                    : isPickup
                      ? "bg-gray-50 border-gray-200 hover:border-daiichi-red/40 hover:bg-red-50"
                      : "bg-gray-50 border-gray-200 hover:border-blue-400/40 hover:bg-blue-50",
                )}
              >
                <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold break-words">{stop.name}</p>
                  {stop.address && <p className={cn("text-[10px] mt-0.5 break-words", selectedStop?.id === stop.id ? "text-white/80" : "text-gray-400")}>{stop.address}</p>}
                  {(stop.surcharge || 0) > 0 && (
                    <p className={cn("text-[10px] font-bold mt-0.5", selectedStop?.id === stop.id ? "text-yellow-200" : "text-green-600")}>
                      +{(stop.surcharge || 0).toLocaleString()}đ
                    </p>
                  )}
                </div>
                {selectedStop?.id === stop.id && <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
              </button>
            ))}

            {filteredStops.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-gray-400 italic">{placeholder}</p>
            )}
          </div>
        </div>
      )}
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
  /**
   * When set, applies mobile-specific "grouped" styling so adjacent inputs appear
   * as a single connected card (no individual borders; shared outer container).
   * 'top' = rounded top corners only; 'bottom' = rounded bottom corners only on last child.
   * sm+ breakpoint always renders individual rounded inputs regardless of this prop.
   */
  grouped?: 'top' | 'bottom';
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
function StopSearchInput({ value, terminalValue, stops, placeholder, nearestHint, mustSelectError, onChange, onConfirmed, pickupSuggestionLabel, selectedStop, onPickupStopSelect, selectStopPrompt, stopPickerMatchingLabel, stopPickerAllLabel, stopPickerCloseLabel, stopPickerNoStopsLabel, grouped }: StopSearchInputProps, ref) {
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

  // Grouped styling: on mobile, adjacent inputs share a container border; sm+ always uses individual rounded inputs.
  const showSubStopPickerButton = Boolean(isConfirmed && pickupStops.length > 0 && onPickupStopSelect);
  // Classes applied to the input / confirmed-display-div when part of a grouped pair.
  let groupedInputClass = '';
  if (grouped === 'top') {
    groupedInputClass = 'border-0 sm:border rounded-t-2xl rounded-b-none sm:rounded-2xl';
  } else if (grouped === 'bottom') {
    // The last visible element (input or sub-stop picker) carries the bottom radius.
    const bottomRadius = showSubStopPickerButton ? 'rounded-b-none sm:rounded-b-2xl' : 'rounded-b-2xl';
    groupedInputClass = cn('border-0 sm:border rounded-t-none sm:rounded-t-2xl', bottomRadius);
  }
  // Classes applied to the sub-stop picker wrapper div when grouped (remove indentation on mobile).
  const groupedPickerWrapperClass = grouped
    ? 'm-0 sm:mt-1.5 sm:ml-5 sm:mr-1 border-t border-gray-200 sm:border-t-0'
    : '';
  // Classes applied to the sub-stop picker trigger button when grouped.
  let groupedPickerButtonClass = '';
  if (grouped === 'top') {
    groupedPickerButtonClass = 'rounded-none sm:rounded-xl border-0 sm:border';
  } else if (grouped === 'bottom') {
    groupedPickerButtonClass = 'rounded-t-none rounded-b-2xl sm:rounded-xl border-0 sm:border';
  }

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
          className={cn(
            "w-full pl-12 pr-14 py-2.5 sm:py-4 bg-gray-50 border border-gray-200 hover:border-daiichi-red rounded-2xl text-sm font-medium text-gray-800 line-clamp-2 leading-snug min-h-[44px] sm:min-h-[56px] cursor-pointer transition-colors",
            groupedInputClass
          )}
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
              ? "border-daiichi-red focus:ring-daiichi-red/20"
              : "border-gray-200 hover:border-daiichi-red focus:border-daiichi-red focus:ring-daiichi-red/20",
            groupedInputClass
          )}
        />
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange('', ''); setShowDropdown(false); setShowMustSelect(false); setLastTypedQuery(''); setShowSubStopPicker(false); pendingOnConfirmedRef.current = false; }}
          className={cn("absolute right-3 text-gray-500 hover:text-gray-800 transition-colors", isConfirmed ? "top-2.5 sm:top-4" : "top-1/2 -translate-y-1/2")}
          aria-label="Clear"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
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
        <div className={cn("mt-1.5 ml-5 mr-1", groupedPickerWrapperClass)}>
          <button
            type="button"
            onClick={() => setShowSubStopPicker(true)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all",
              selectedStop
                ? "bg-gray-50 border-gray-200 text-gray-800"
                : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-700",
              groupedPickerButtonClass
            )}
          >
            <div className="flex items-center gap-2 min-w-0 ml-10">
              <MapPin size={13} className={cn("flex-shrink-0", selectedStop ? "text-gray-500" : "text-gray-400")} />
              <span className="truncate text-left text-xs">
                {selectedStop || selectStopPrompt || pickupSuggestionLabel}
              </span>
            </div>
            {selectedStop ? (
              <X size={13} className="flex-shrink-0 text-daiichi-red" />
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

// ---------------------------------------------------------------------------
// StepIndicator – 4-step progress bar shown at the top of TripConfirmPanel
// ---------------------------------------------------------------------------
interface StepIndicatorProps {
  currentStep: number; // 1=trip, 2=pickup/dropoff, 3=seat, 4=payment
  labels: [string, string, string, string];
}
function StepIndicator({ currentStep, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {labels.map((label, idx) => {
        const step = idx + 1;
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all flex-shrink-0",
                isDone ? "bg-green-500 border-green-500 text-white" :
                isActive ? "bg-daiichi-red border-daiichi-red text-white" :
                "bg-white border-gray-300 text-gray-400"
              )}>
                {isDone ? <CheckCircle2 size={14} /> : step}
              </div>
              <span className={cn(
                "text-[9px] mt-0.5 text-center leading-tight font-semibold truncate w-full px-0.5",
                isActive ? "text-daiichi-red" : isDone ? "text-green-600" : "text-gray-400"
              )}>{label}</span>
            </div>
            {idx < 3 && (
              <div className={cn(
                "h-0.5 flex-1 mx-1 mt-[-10px] rounded-full transition-all",
                isDone ? "bg-green-400" : "bg-gray-200"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TripConfirmPanel – full-screen overlay that shows after a user picks a trip.
// Displays: step indicator, trip details, route itinerary, pickup/dropoff
// selector, price breakdown, and a "Confirm & Select Seat" button.
// ---------------------------------------------------------------------------
interface TripConfirmPanelProps {
  trip: Trip;
  route: Route | undefined;
  language: Language;
  segmentFares: Map<string, { price: number; agentPrice?: number }>;
  searchStationFrom: string;
  searchStationTo: string;
  searchFrom: string;
  searchTo: string;
  roundTripPhase: 'outbound' | 'return';
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  currentUser: any | null;
  searchAdults: number;
  searchChildren: number;
  searchChildrenAges: (number | undefined)[];
  /** IDs of addons selected on the BookTicketPage card (TOUR_SHORT only) */
  selectedAddons?: string[];
  onConfirm: () => void;
  onClose: () => void;
}

function TripConfirmPanel({
  trip, route, language, segmentFares,
  searchStationFrom, searchStationTo, searchFrom, searchTo,
  roundTripPhase, tripType, currentUser, searchAdults, searchChildren, searchChildrenAges,
  selectedAddons,
  onConfirm, onClose,
}: TripConfirmPanelProps) {
  const t = TRANSLATIONS[language];
  const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
  const effectiveFrom = isReturnPhase ? (searchStationTo || searchTo) : (searchStationFrom || searchFrom);
  const effectiveTo = isReturnPhase ? (searchStationFrom || searchFrom) : (searchStationTo || searchTo);

  // ---- Passenger count summary ----
  const childrenOver4Count = searchChildrenAges.filter(age => age !== undefined && age >= 4).length;
  const childrenUnder4Count = searchChildren - childrenOver4Count;
  const billablePassengers = searchAdults + childrenOver4Count;

  // ---- helpers ----
  const getApplicableRouteSurcharges = (r: Route | undefined, tripDate: string): RouteSurcharge[] => {
    if (!r?.surcharges) return [];
    return r.surcharges.filter(sc => {
      if (!sc.isActive) return false;
      if (sc.startDate && sc.endDate) return !!tripDate && tripDate >= sc.startDate && tripDate <= sc.endDate;
      return true;
    });
  };

  const tripDate = trip.date || '';
  const applicableSurcharges = getApplicableRouteSurcharges(route, tripDate);

  // ---- Time calculation ----
  const calcTime = (base: string, offsetMins: number): string => {
    const [h, m] = base.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return base;
    const total = h * 60 + m + offsetMins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  /** Returns "DD/MM" for a stop, incrementing date if the stop time wraps past midnight. */
  const getStopDatePrefix = (stopTimeStr: string | null): string | null => {
    if (!stopTimeStr || !trip.date || !trip.time) return null;
    const parts = trip.date.split('-');
    if (parts.length !== 3) return null;
    const [depH, depM] = trip.time.split(':').map(Number);
    const [stopH, stopM] = stopTimeStr.split(':').map(Number);
    const depTotalMins = depH * 60 + depM;
    const stopTotalMins = stopH * 60 + stopM;
    // If stop is earlier in the day than departure, it has crossed midnight
    const dayOffset = stopTotalMins < depTotalMins ? 1 : 0;
    // Use explicit constructor parameters for consistent cross-browser behavior
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + dayOffset);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const depOffsetMins = (() => {
    if (!trip.time) return 0;
    const matchedStop = route?.routeStops?.find(s =>
      effectiveFrom && (s.stopName === effectiveFrom || matchesSearch(s.stopName, effectiveFrom))
    );
    if (matchedStop) return matchedStop.offsetMinutes ?? 0;
    return route?.departureOffsetMinutes ?? 0;
  })();

  const arrOffsetMins = (() => {
    if (!trip.time) return null;
    const arrPt = route?.arrivalPoint || '';
    const isFinalDestination = Boolean(arrPt && effectiveTo && (
      arrPt === effectiveTo || matchesSearch(arrPt, effectiveTo) || matchesSearch(effectiveTo, arrPt)
    ));
    if (!isFinalDestination) {
      const matchedArrStop = route?.routeStops?.find(s =>
        effectiveTo && (s.stopName === effectiveTo || matchesSearch(s.stopName, effectiveTo))
      );
      if (matchedArrStop && (matchedArrStop.offsetMinutes ?? 0) > 0) return matchedArrStop.offsetMinutes ?? 0;
    }
    const routeArrOffset = route?.arrivalOffsetMinutes ?? 0;
    if (routeArrOffset > 0) return routeArrOffset;
    if (route?.duration) {
      const parsed = parseDurationToMinutes(route.duration);
      if (parsed && parsed > 0) return parsed;
    }
    const matchedArrStop = route?.routeStops?.find(s =>
      effectiveTo && (s.stopName === effectiveTo || matchesSearch(s.stopName, effectiveTo))
    );
    if (matchedArrStop && (matchedArrStop.offsetMinutes ?? 0) > 0) return matchedArrStop.offsetMinutes ?? 0;
    return null;
  })();

  const depTime = trip.time ? calcTime(trip.time, depOffsetMins) : null;
  const arrTime = trip.time && arrOffsetMins !== null ? calcTime(trip.time, arrOffsetMins) : null;

  // ---- Ordered itinerary stops ----
  const orderedItinerary = useMemo(() => {
    const stops_list: { name: string; time: string | null; isEndpoint: boolean; description?: string }[] = [];
    const dep = route?.departurePoint || effectiveFrom || '';
    const arr = route?.arrivalPoint || effectiveTo || '';
    if (dep) stops_list.push({ name: dep, time: trip.time ? calcTime(trip.time, route?.departureOffsetMinutes ?? 0) : null, isEndpoint: true });
    if (route?.routeStops && route.routeStops.length > 0) {
      route.routeStops
        .filter(s => s.stopId !== '__departure__' && s.stopId !== '__arrival__')
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach(s => {
          stops_list.push({
            name: s.stopName,
            time: trip.time && (s.offsetMinutes ?? 0) > 0 ? calcTime(trip.time, s.offsetMinutes ?? 0) : null,
            isEndpoint: false,
            description: s.description,
          });
        });
    }
    if (arr && arr !== dep) {
      // Compute the route's actual arrival time from authoritative route-level data so
      // that the final stop always shows the correct time even when the user searched
      // a sub-segment (where arrTime reflects the sub-segment destination, not the
      // route's true endpoint).
      const finalArrTime = (() => {
        if (!trip.time) return null;
        const o = route?.arrivalOffsetMinutes ?? 0;
        if (o > 0) return calcTime(trip.time, o);
        if (route?.duration) {
          const parsed = parseDurationToMinutes(route.duration);
          if (parsed && parsed > 0) return calcTime(trip.time, parsed);
        }
        // Check if the arrivalPoint itself appears as a routeStop with an offset
        const matchedStop = route?.routeStops?.find(s =>
          s.stopId !== '__departure__' && s.stopId !== '__arrival__' &&
          (s.stopName === arr || matchesSearch(s.stopName, arr) || matchesSearch(arr, s.stopName))
        );
        if (matchedStop && (matchedStop.offsetMinutes ?? 0) > 0) return calcTime(trip.time, matchedStop.offsetMinutes ?? 0);
        return arrTime;
      })();
      stops_list.push({ name: arr, time: finalArrTime, isEndpoint: true });
    }
    return stops_list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.id, trip.time, effectiveFrom, effectiveTo, arrTime]);

  const displayArrivalStop = useMemo(() => {
    const preferredName = effectiveTo || route?.arrivalPoint || '';
    // Prefer exact name match first to avoid matching a stop whose name merely
    // contains the searched destination as a substring (e.g. "Bến Viềng Cát Bà"
    // matching when the user searched for "Cát Bà").
    const matchedStop = preferredName
      ? (orderedItinerary.find(stop => stop.name === preferredName)
          ?? orderedItinerary.find(stop =>
              matchesSearch(stop.name, preferredName) || matchesSearch(preferredName, stop.name),
            ))
      : null;
    if (matchedStop) return matchedStop;
    const lastStop = orderedItinerary[orderedItinerary.length - 1];
    return lastStop ?? { name: preferredName || '—', time: arrTime, isEndpoint: true };
  }, [orderedItinerary, effectiveTo, route?.arrivalPoint, arrTime]);

  // ---- Fare calculation ----
  const segFare = route ? segmentFares.get(route.id) : undefined;
  const isAgent = currentUser?.role === UserRole.AGENT;
  const retailBase = segFare ? segFare.price : (trip.price || 0);
  const agentBase = isAgent ? (segFare?.agentPrice || trip.agentPrice || null) : null;
  const baseFare = agentBase !== null ? agentBase : retailBase;
  const discountPct = trip.discountPercent || 0;
  const discountedFare = discountPct > 0 ? Math.round(baseFare * (1 - discountPct / 100)) : baseFare;
  const routeSurchargeTotal = applicableSurcharges.reduce((sum, sc) => sum + sc.amount, 0);
  const totalPerPerson = discountedFare + routeSurchargeTotal;
  const grandTotal = totalPerPerson * billablePassengers;

  // Apply childPricingRules for per-age-group pricing when the route has rules configured.
  // This works for all route categories (BUS, TOUR_SHORT, etc.).
  // Default behaviour (no rules): children ≥4 pay adult price, children <4 are free.
  const childPricingRules = route?.childPricingRules ?? [];
  const useAgePricing = childPricingRules.length > 0;
  const childAgeGroups: { label: string; count: number; farePer: number }[] = (() => {
    if (!useAgePricing || searchChildren === 0) return [];
    const groupMap = new Map<string, { label: string; count: number; farePer: number }>();
    searchChildrenAges.slice(0, searchChildren).forEach((age) => {
      const ageVal = age ?? 0;
      const rule = childPricingRules.find(r => ageVal >= r.fromAge && ageVal <= r.toAge);
      const farePer = rule ? Math.round(totalPerPerson * rule.percent / 100) : totalPerPerson;
      const groupKey = rule ? rule.id : '__no_rule__';
      const label = rule
        ? (language === 'vi'
            ? `Trẻ ${rule.fromAge}–${rule.toAge} tuổi (${rule.percent}%)`
            : language === 'ja'
              ? `子供 ${rule.fromAge}–${rule.toAge}歳 (${rule.percent}%)`
              : `Children ${rule.fromAge}–${rule.toAge} yrs (${rule.percent}%)`)
        : (language === 'vi' ? 'Trẻ em' : language === 'ja' ? '子供' : 'Children');
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, { label, count: 0, farePer });
      groupMap.get(groupKey)!.count++;
    });
    return Array.from(groupMap.values());
  })();
  const displayGrandTotal = useAgePricing && searchChildren > 0
    ? totalPerPerson * searchAdults + childAgeGroups.reduce((s, g) => s + g.count * g.farePer, 0)
    : grandTotal;
  const displayTotalPassengers = searchAdults + searchChildren;

  // ---- Selected addons (TOUR_SHORT) ----
  const selectedAddonObjects = (trip.addons || []).filter(a => (selectedAddons || []).includes(a.id));
  const addonPricePerPerson = selectedAddonObjects.reduce((sum, a) => sum + a.price, 0);
  // Addons apply to all passengers (adults + children), consistent with SeatMappingPage behaviour
  const addonPassengerCount = displayTotalPassengers;
  const addonGrandTotal = addonPricePerPerson * addonPassengerCount;

  const stepLabels: [string, string, string, string] = [
    t.step_select_trip || 'Chọn chuyến',
    language === 'vi' ? 'Nhập thông tin' : language === 'ja' ? '情報入力' : 'Enter Info',
    t.step_pickup_dropoff || 'Điểm đón/trả',
    t.step_payment || 'Thanh toán',
  ];

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-3 pb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-daiichi-red transition-colors"
          >
            <X size={18} />
            <span className="hidden sm:inline">{t.trip_confirm_back || 'Quay lại'}</span>
          </button>
          <div className="flex-1">
            <StepIndicator currentStep={1} labels={stepLabels} />
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-32">

          {/* ── Trip info card ── */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-3 py-1 bg-daiichi-accent text-daiichi-red rounded-full text-xs font-bold uppercase">{trip.route}</span>
              {trip.date && (
                <span className="px-2.5 py-1 bg-red-50 text-daiichi-red rounded-full text-xs font-bold flex-shrink-0">{formatBookingDate(trip.date)}</span>
              )}
            </div>
            {/* Departure → Arrival with times */}
            <div className="flex items-stretch gap-3">
              <div className="flex flex-col items-center flex-shrink-0 pt-1">
                <div className="w-2 h-2 rounded-full bg-daiichi-red" />
                <div className="w-px flex-1 bg-gray-300 my-1" />
                <div className="w-2 h-2 rounded-full bg-blue-400" />
              </div>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div>
                  <div className="flex items-baseline gap-2">
                    {depTime && <span className="text-lg font-bold text-daiichi-red leading-none">{depTime}</span>}
                    <span className="text-sm font-semibold text-gray-800 truncate">{effectiveFrom || route?.departurePoint || '—'}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t.trip_confirm_departure_time || 'Giờ xuất bến'}</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    {displayArrivalStop.time && <span className="text-base font-bold text-blue-500 leading-none">{displayArrivalStop.time}</span>}
                    <span className="text-sm font-medium text-gray-600 truncate">{displayArrivalStop.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t.trip_confirm_arrival_time || 'Giờ dự kiến đến'}</p>
                </div>
              </div>
            </div>
            {/* Meta row: driver, vehicle */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200">
              {trip.driverName && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users size={12} className="flex-shrink-0" />
                  <span>{trip.driverName}</span>
                </div>
              )}
              {trip.licensePlate && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Bus size={12} className="flex-shrink-0" />
                  <span>{trip.licensePlate}</span>
                </div>
              )}
              {route?.duration && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} className="flex-shrink-0" />
                  <span>{route.duration}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Route Itinerary ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <MapPin size={14} className="text-daiichi-red flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.trip_confirm_route_title || 'Hành trình sẽ đi qua'}</h3>
            </div>
            <div className="p-4">
              {orderedItinerary.length <= 2 ? (
                <p className="text-xs text-gray-400 italic">{t.trip_confirm_no_intermediate || 'Chạy thẳng, không dừng trung gian'}</p>
              ) : (
                <div className="space-y-0">
                  {orderedItinerary.map((stop, idx) => (
                    <div key={idx} className="flex items-stretch gap-3 min-w-0">
                      <div className="flex flex-col items-center flex-shrink-0 w-4">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5",
                          stop.isEndpoint ? (idx === 0 ? "bg-daiichi-red" : "bg-blue-400") : "bg-gray-300"
                        )} />
                        {idx < orderedItinerary.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 my-0.5" />
                        )}
                      </div>
                      <div className={cn("flex-1 min-w-0 pb-2", idx === orderedItinerary.length - 1 ? "pb-0" : "")}>
                        <div className="flex items-center gap-2">
                          {stop.time && (
                            <span className={cn(
                              "text-[10px] font-bold flex-shrink-0",
                              idx === 0 ? "text-daiichi-red" : stop.isEndpoint ? "text-blue-500" : "text-gray-400"
                            )}>
                              {getStopDatePrefix(stop.time) && (
                                <span className="opacity-70 mr-0.5">{getStopDatePrefix(stop.time)} </span>
                              )}
                              {stop.time}
                            </span>
                          )}
                          <span className={cn(
                            "text-xs truncate",
                            stop.isEndpoint ? "font-semibold text-gray-800" : "font-medium text-gray-600"
                          )}>{stop.name}</span>
                        </div>
                        {stop.description && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{stop.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Passenger summary ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Users size={14} className="text-daiichi-red flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                {language === 'vi' ? 'Hành khách' : language === 'ja' ? '乗客' : 'Passengers'}
              </h3>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{language === 'vi' ? 'Người lớn' : language === 'ja' ? '大人' : 'Adults'}</span>
                <span className="font-bold text-gray-800">{searchAdults}</span>
              </div>
              {searchChildren > 0 && (
                <>
                  {useAgePricing ? (
                    /* TOUR_SHORT: show per-age-group breakdown from childPricingRules */
                    childAgeGroups.map((g, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{g.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{g.count}</span>
                          <span className="text-[10px] text-gray-400">×{g.farePer.toLocaleString()}đ</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    /* BUS / default: simple over/under 4 logic */
                    <>
                      {childrenOver4Count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {language === 'vi' ? `Trẻ em ≥4 tuổi (tính giá người lớn)` : language === 'ja' ? '4歳以上の子供（大人料金）' : 'Children ≥4 (adult price)'}
                          </span>
                          <span className="font-bold text-daiichi-red">{childrenOver4Count}</span>
                        </div>
                      )}
                      {childrenUnder4Count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {language === 'vi' ? 'Trẻ em <4 tuổi (miễn phí)' : language === 'ja' ? '4歳未満の子供（無料）' : 'Children <4 (free)'}
                          </span>
                          <span className="font-bold text-green-600">{childrenUnder4Count}</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-sm">
                <span className="font-bold text-gray-700">
                  {language === 'vi' ? 'Tổng hành khách' : language === 'ja' ? '合計人数' : 'Total pax'}
                </span>
                <span className="font-bold text-daiichi-red">
                  {useAgePricing ? displayTotalPassengers : billablePassengers}
                </span>
              </div>
            </div>
          </div>

          {/* ── Price breakdown ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Info size={14} className="text-blue-500 flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.trip_confirm_price_title || 'Chi tiết giá vé'}</h3>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t.trip_confirm_base_fare || 'Giá vé cơ bản'}</span>
                <div className="flex items-center gap-2">
                  {discountPct > 0 && <span className="text-[10px] text-gray-400 line-through">{baseFare.toLocaleString()}đ</span>}
                  <span className="font-bold text-gray-800">{discountedFare.toLocaleString()}đ</span>
                  {discountPct > 0 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 rounded-full">-{discountPct}%</span>}
                </div>
              </div>
              {applicableSurcharges.map(sc => (
                <div key={sc.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t.trip_confirm_surcharges || 'Phụ phí tuyến'}: {sc.name}</span>
                  <span className="font-semibold text-orange-600">+{sc.amount.toLocaleString()}đ</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-600">
                  {useAgePricing
                    ? (language === 'vi' ? 'Giá người lớn / người' : language === 'ja' ? '大人料金 / 人' : 'Adult fare / person')
                    : (t.trip_confirm_total || 'Tổng dự kiến / người')}
                </span>
                <span className="text-sm font-bold text-gray-800">{totalPerPerson.toLocaleString()}đ</span>
              </div>
              {useAgePricing && childAgeGroups.length > 0 && (
                <div className="space-y-1 pt-1">
                  {childAgeGroups.map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{g.label} ×{g.count}</span>
                      <span className="font-semibold text-gray-800">{(g.count * g.farePer).toLocaleString()}đ</span>
                    </div>
                  ))}
                </div>
              )}
              {(useAgePricing ? displayTotalPassengers : billablePassengers) > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">
                    {language === 'vi'
                      ? `Tổng ${useAgePricing ? displayTotalPassengers : billablePassengers} khách (dự kiến)`
                      : language === 'ja'
                        ? `合計 ${useAgePricing ? displayTotalPassengers : billablePassengers}名（概算）`
                        : `Total ${useAgePricing ? displayTotalPassengers : billablePassengers} pax (est.)`}
                  </span>
                  <span className="text-base font-bold text-daiichi-red">{displayGrandTotal.toLocaleString()}đ</span>
                </div>
              )}
              {/* ── Selected add-on services (TOUR_SHORT) ── */}
              {selectedAddonObjects.length > 0 && (
                <div className="pt-2 border-t border-gray-100 space-y-1.5">
                  <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 uppercase">
                    <Gift size={10} />
                    {language === 'vi' ? 'Dịch vụ kèm theo' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}
                  </p>
                  {selectedAddonObjects.map(addon => (
                    <div key={addon.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{addon.name} ×{addonPassengerCount}</span>
                      <span className="font-semibold text-emerald-600">+{(addon.price * addonPassengerCount).toLocaleString()}đ</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1.5 border-t border-emerald-100">
                    <span className="text-sm font-bold text-gray-800">
                      {language === 'vi' ? 'Tổng cộng (dự kiến)' : language === 'ja' ? '合計（概算）' : 'Grand Total (est.)'}
                    </span>
                    <span className="text-base font-bold text-daiichi-red">{(displayGrandTotal + addonGrandTotal).toLocaleString()}đ</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tip note */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
            <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">
              {language === 'vi'
                ? 'Vui lòng xác nhận thông tin chuyến trước khi tiếp tục nhập thông tin hành khách và chọn ghế'
                : language === 'ja'
                  ? '次のステップで乗客情報と座席選択を行います'
                  : 'Please confirm the trip details before proceeding to enter passenger info and select seats'}
            </p>
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              <X size={15} />
              <span className="hidden sm:inline">{t.trip_confirm_back || 'Quay lại'}</span>
            </button>
            <button
              type="button"
              onClick={() => onConfirm()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all"
            >
              <CheckCircle2 size={16} />
              <span>
                {language === 'vi' ? 'Tiếp theo: Nhập thông tin & Chọn ghế' : language === 'ja' ? '次へ：情報入力・座席選択' : 'Next: Enter Info & Select Seat'}
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
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
  searchChildrenAges: (number | undefined)[];
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
  setSearchChildrenAges: React.Dispatch<React.SetStateAction<(number | undefined)[]>>;
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
  setAddonQuantities?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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
  // Favorites
  likedTrips: Set<string>;
  toggleLikedTrip: (tripId: string) => void;
  // Category filter from home page icons
  routeCategoryFilter?: string;
  setRouteCategoryFilter?: (v: string) => void;
  /** When set, the page is locked to this category and the clear-filter button is hidden. */
  lockedCategoryFilter?: string;
}

// Snapshot of search parameters committed when the Search button is clicked.
// filterTrip() uses these values so the trip list only updates on explicit button click.
interface CommittedSearchParams {
  from: string; to: string;
  stationFrom: string; stationTo: string;
  date: string; returnDate: string;
  adults: number; children: number;
  priceMinVal: string; priceMaxVal: string;
  timeFrom: string; timeTo: string;
  freeSearch: string;
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
  searchChildrenAges,
  setSearchChildrenAges,
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
  setAddonQuantities,
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
  likedTrips,
  toggleLikedTrip,
  routeCategoryFilter,
  setRouteCategoryFilter,
  lockedCategoryFilter,
}: BookTicketPageProps) {
  const t = TRANSLATIONS[language];
  const { toasts, showToast, dismissToast } = useToast();

  // Extra trips loaded on demand beyond the initial 500-trip subscription
  const [extraTrips, setExtraTrips] = useState<Trip[]>([]);
  const [loadingAllTrips, setLoadingAllTrips] = useState(false);
  const [allTripsLoaded, setAllTripsLoaded] = useState(false);
  const [loadedTripCount, setLoadedTripCount] = useState(0);
  const loadAbortRef = useRef<{ aborted: boolean }>({ aborted: false });

  // Merged trips: real-time subscription (trips prop) takes priority over extra snapshot trips
  const allTrips = useMemo(() => {
    if (extraTrips.length === 0) return trips;
    const map = new Map(trips.map(t => [t.id, t]));
    for (const t of extraTrips) if (!map.has(t.id)) map.set(t.id, t);
    return Array.from(map.values());
  }, [trips, extraTrips]);

  const handleLoadAllTrips = async () => {
    if (loadingAllTrips) return;
    setLoadingAllTrips(true);
    setAllTripsLoaded(false);
    setExtraTrips([]);
    setLoadedTripCount(0);
    const signal = { aborted: false };
    loadAbortRef.current = signal;
    const accumulated: Trip[] = [];
    try {
      await transportService.loadAllTripsBatched((batch) => {
        accumulated.push(...batch);
        setExtraTrips([...accumulated]);
        setLoadedTripCount(accumulated.length);
      }, 500, signal);
      setAllTripsLoaded(true);
    } finally {
      setLoadingAllTrips(false);
    }
  };

  // Effective category filter: lockedCategoryFilter takes precedence over the prop passed from parent.
  const effectiveCategoryFilter = lockedCategoryFilter ?? routeCategoryFilter ?? '';

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

  // Local filter state: combined vehicle type + seat count (e.g. "Limousine 11 ghế")
  const [localVehicleCombo, setLocalVehicleCombo] = useState('');

  // Advanced filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  type AdvSortBy = 'default' | 'price_asc' | 'price_desc' | 'time_asc' | 'time_desc' | 'duration_asc';
  const [advSortBy, setAdvSortBy] = useState<AdvSortBy>('default');
  const [advTimeSlots, setAdvTimeSlots] = useState<Set<string>>(new Set());

  const advHasFilters = advSortBy !== 'default' || advTimeSlots.size > 0;

  // Returns true if trip's departure time falls in the given slot name
  const tripInTimeSlot = (time: string, slot: string): boolean => {
    if (!time) return false;
    const h = parseInt(time.split(':')[0], 10);
    if (isNaN(h)) return false;
    switch (slot) {
      case 'morning': return h >= 5 && h < 12;
      case 'noon': return h >= 12 && h < 14;
      case 'afternoon': return h >= 14 && h < 18;
      case 'evening': return h >= 18 && h < 22;
      case 'night': return h >= 22 || h < 5;
      default: return true;
    }
  };

  // Apply a date quick-select option: update searchDate and committedParams
  const applyDateQuickOption = (option: string) => {
    const today = getLocalDateString();
    const offsetFromToday = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };
    const offsetFromCommitted = (days: number) => {
      const base = committedParams?.date || searchDate || today;
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };
    let newDate = today;
    if (option === 'today') newDate = today;
    else if (option === 'tomorrow') newDate = offsetFromToday(1);
    else if (option === 'day_after') newDate = offsetFromToday(2);
    else if (option === 'minus1') newDate = offsetFromCommitted(-1);
    else if (option === 'minus2') newDate = offsetFromCommitted(-2);
    setSearchDate(newDate);
    setCommittedParams(prev => prev ? { ...prev, date: newDate } : prev);
  };

  // Compute unique vehicle type+seat combinations from active trips for the combined filter
  const availableCombinations = useMemo(() => {
    const activePlates = new Set(
      allTrips
        .filter(tr => tr.status === TripStatus.WAITING || tr.status === TripStatus.RUNNING)
        .map(tr => tr.licensePlate)
    );
    const seen = new Map<string, { type: string; seats: number; label: string }>();
    vehicles.filter(v => activePlates.has(v.licensePlate)).forEach(v => {
      if (v.type) {
        const key = `${v.type}::${v.seats || 0}`;
        if (!seen.has(key)) {
          seen.set(key, {
            type: v.type,
            seats: v.seats || 0,
            label: v.seats ? `${v.type} ${v.seats} ghế` : v.type,
          });
        }
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allTrips, vehicles]);

  // Parse the combo value into type/seats for filter comparisons
  const comboType = localVehicleCombo ? localVehicleCombo.split('::')[0] : '';
  const comboSeats = localVehicleCombo ? parseInt(localVehicleCombo.split('::')[1]) || 0 : 0;

  // Committed search parameters: set when the user clicks the Search button.
  // filterTrip() and segmentFares use these values so that the list only updates
  // when the button is explicitly clicked, not on every keystroke.
  // Lazily initialized from the current search props when hasSearched is already true
  // (e.g. when the component remounts after returning from the seat-mapping tab for the
  // return leg of a round trip).
  const [committedParams, setCommittedParams] = useState<CommittedSearchParams | null>(() =>
    hasSearched
      ? {
          from: searchFrom, to: searchTo,
          stationFrom: searchStationFrom, stationTo: searchStationTo,
          date: searchDate, returnDate: searchReturnDate,
          adults: searchAdults, children: searchChildren,
          priceMinVal: priceMin, priceMaxVal: priceMax,
          timeFrom: searchTimeFrom, timeTo: searchTimeTo,
          freeSearch: bookTicketSearch,
        }
      : null
  );

  // Segment-based fare lookup: map from routeId → { price, agentPrice }
  // Updated whenever the customer's searchFrom / searchTo changes.
  const [segmentFares, setSegmentFares] = useState<Map<string, { price: number; agentPrice?: number }>>(new Map());
  // True once the async fare check for the current from/to pair has completed.
  // Used to filter out trips whose route has no fare configuration for the searched segment.
  const [segmentFaresLoaded, setSegmentFaresLoaded] = useState(false);
  const segmentFareFetchRef = useRef(0);
  // Set to true in handleSearch when the notification should be shown after fares finish loading.
  // Cleared once the notification has been displayed.
  const pendingNotificationRef = useRef(false);
  // Tracks the previous value of segmentFaresLoaded so we can detect the false→true transition.
  const prevSegmentFaresLoadedRef = useRef(false);
  // Ref to the "To" StopSearchInput – used to auto-focus it when "From" is confirmed.
  const toStopRef = useRef<StopSearchInputHandle>(null);

  // Track which trip the user clicked "Select Seat" on – used to show the TripConfirmPanel
  // before navigating to seat-mapping. null = no confirmation panel open.
  const [pendingConfirmTrip, setPendingConfirmTrip] = useState<Trip | null>(null);

  // Image lightbox: stores which trip+image is being viewed full-screen
  const [lightboxState, setLightboxState] = useState<{ tripId: string; imgIdx: number } | null>(null);
  // Touch tracking for swipe gestures (carousel + lightbox)
  const cardSwipeTouchX = useRef<Record<string, number>>({});
  const lightboxTouchX = useRef(0);

  // For TOUR_SHORT trips: track which addons are selected per trip (tripId → addonId[])
  const [selectedAddonsByTrip, setSelectedAddonsByTrip] = useState<Record<string, string[]>>({});
  const [showSingleAddonDetail, setShowSingleAddonDetail] = useState<TripAddon | null>(null);

  const toggleAddon = (tripId: string, addonId: string) => {
    setSelectedAddonsByTrip(prev => {
      const current = prev[tripId] || [];
      const idx = current.indexOf(addonId);
      return {
        ...prev,
        [tripId]: idx === -1 ? [...current, addonId] : current.filter(id => id !== addonId),
      };
    });
  };

  // Handler for the "From" stop input: clears pre-selected pickup when terminal is cleared.
  const handleFromChange = (text: string, terminal: string) => {
    setSearchFrom(text);
    setSearchStationFrom(terminal);
    // Do NOT reset hasSearched here – results remain visible until the search
    // button is clicked again (committed params drive the filter, not live inputs).
  };

  // Handler for the "To" stop input.
  const handleToChange = (text: string, terminal: string) => {
    setSearchTo(text);
    setSearchStationTo(terminal);
    // Do NOT reset hasSearched – committed params drive the filter.
  };

  // Swap origin and destination.
  const handleSwap = () => {
    const prevFrom = searchFrom;
    const prevStationFrom = searchStationFrom;
    setSearchFrom(searchTo);
    setSearchStationFrom(searchStationTo);
    setSearchTo(prevFrom);
    setSearchStationTo(prevStationFrom);
    // Do NOT reset hasSearched – committed params drive the filter.
  };

  useEffect(() => {
    // Only fetch segment fares when the user has committed a search (clicked the button).
    // This avoids Firestore reads on every keystroke and ensures the list only refreshes
    // when the customer explicitly clicks "Search".
    if (!committedParams) {
      setSegmentFares(new Map());
      setSegmentFaresLoaded(false);
      return;
    }
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    // Prefer specific stop selection (stationFrom/To) over plain city text (from/to)
    const effectiveFrom = isReturnPhase
      ? (committedParams.stationTo || committedParams.to)
      : (committedParams.stationFrom || committedParams.from);
    const effectiveTo = isReturnPhase
      ? (committedParams.stationFrom || committedParams.from)
      : (committedParams.stationTo || committedParams.to);

    if (!effectiveFrom || !effectiveTo) {
      setSegmentFares(new Map());
      setSegmentFaresLoaded(false);
      return;
    }

    setSegmentFaresLoaded(false);
    const fetchId = ++segmentFareFetchRef.current;

    const fetchFares = async () => {
      const uniqueRouteNames = [...new Set(allTrips.map(t => t.route))];

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

          // Use route.price directly when:
          // (a) the route is direct (no intermediate stops) – the full route is the only segment, or
          // (b) the search is for the full route (effectiveFrom = departurePoint AND
          //     effectiveTo = arrivalPoint) – the explicit per-segment fare table may not
          //     include a __departure__ → __arrival__ entry even though route.price is set.
          const isFullRouteSearch = !hasIntermediateStops || (
            route.departurePoint && route.arrivalPoint &&
            (effectiveFrom === route.departurePoint || matchesSearch(route.departurePoint, effectiveFrom) || matchesSearch(effectiveFrom, route.departurePoint)) &&
            (effectiveTo === route.arrivalPoint || matchesSearch(route.arrivalPoint, effectiveTo) || matchesSearch(effectiveTo, route.arrivalPoint))
          );
          if (isFullRouteSearch) {
            if (!route.price) return null;
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
          } catch (_err) {
            // No explicitly configured fare for this segment → do not show the trip.
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
  }, [committedParams, tripType, roundTripPhase, routes, stops, allTrips]);

  // Show the search result notification after segment fares have finished loading for the current
  // search. We track the false→true transition of segmentFaresLoaded so we don't accidentally fire
  // on a stale `true` value that was left over from a previous search.
  useEffect(() => {
    const wasLoaded = prevSegmentFaresLoadedRef.current;
    prevSegmentFaresLoadedRef.current = segmentFaresLoaded;

    if (!wasLoaded && segmentFaresLoaded && pendingNotificationRef.current) {
      pendingNotificationRef.current = false;
      const vehicleMap = new Map(vehicles.map(v => [v.licensePlate, v]));
      const count = allTrips.filter(trip => {
        if (!filterTrip(trip, true)) return false;
        if (localVehicleCombo) {
          const v = vehicleMap.get(trip.licensePlate);
          if (comboType && v?.type !== comboType) return false;
          if (comboSeats > 0 && v?.seats !== comboSeats) return false;
        }
        return true;
      }).length;
      if (count > 0) {
        showToast(t.search_results_found.replace('{count}', String(count)), 'success');
      } else {
        showToast(t.no_trips_found, 'info');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentFaresLoaded, allTrips]);

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
      // Prefer exact name match first; fall back to substring/accent-folded match.
      let fromIdx = orderedStops.findIndex(name => name === effectiveFrom);
      if (fromIdx === -1) fromIdx = orderedStops.findIndex(name =>
        matchesSearch(name as string, effectiveFrom) || matchesSearch(effectiveFrom, name as string));
      if (fromIdx === -1) return false;
      let toIdx = orderedStops.findIndex(name => name === effectiveTo);
      if (toIdx === -1) toIdx = orderedStops.findIndex(name =>
        matchesSearch(name as string, effectiveTo) || matchesSearch(effectiveTo, name as string));
      return toIdx !== -1 && fromIdx < toIdx;
    });
  }, [searchFrom, searchTo, tripType, roundTripPhase, routes]);

  // When a category filter is active, narrow the stop suggestions to only terminals /
  // child stops whose classification matches the active route category (BUS, TOUR_SHORT, etc.).
  const filteredStops = useMemo<Stop[]>(() => {
    if (!effectiveCategoryFilter) return stops;

    // Filter by the terminal's vehicleTypes field which now stores the route category.
    const terminalsWithCategory = stops.filter(s => s.type === 'TERMINAL' && s.vehicleTypes);
    if (terminalsWithCategory.length > 0) {
      const allowedTerminalIds = new Set<string>(
        terminalsWithCategory
          .filter(t => t.vehicleTypes === effectiveCategoryFilter)
          .map(t => t.id)
      );
      // Return only matching terminals and their child stops.
      // When no terminals match the active category, return an empty list so
      // users aren't confused by unrelated stops appearing.
      return stops.filter(stop => {
        if (stop.type === 'TERMINAL') return allowedTerminalIds.has(stop.id);
        return stop.terminalId ? allowedTerminalIds.has(stop.terminalId) : false;
      });
    }

    // Fallback: no terminals have categories set yet – show all stops.
    return stops;
  }, [effectiveCategoryFilter, stops]);

  // filterTrip accepts an optional explicit params object so that handleSearch can pass
  // the newly-committed values synchronously (before the React state update is applied).
  const filterTrip = (trip: Trip, includeDate: boolean, params?: {
    from: string; to: string; stationFrom: string; stationTo: string;
    date: string; returnDate: string; adults: number; children: number;
    priceMinVal: string; priceMaxVal: string; timeFrom: string; timeTo: string;
    freeSearch: string;
  } | null) => {
    const p = params !== undefined ? params : committedParams;
    // Before the first search no committed params exist → nothing to show.
    if (!p) return false;

    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    const effectiveFrom = isReturnPhase ? (p.stationTo || p.to) : (p.stationFrom || p.from);
    const effectiveTo = isReturnPhase ? (p.stationFrom || p.from) : (p.stationTo || p.to);
    const effectiveDate = isReturnPhase ? p.returnDate : p.date;

    // Show WAITING and RUNNING trips. RUNNING trips are visible but not directly bookable.
    if (trip.status !== TripStatus.WAITING && trip.status !== TripStatus.RUNNING) return false;
    const tripRoute = routeByName.get(trip.route);
    const tripVehicle = p.freeSearch
      ? vehicles.find(v => v.licensePlate === trip.licensePlate)
      : undefined;
    if (p.freeSearch) {
      const searchable = [
        trip.route || '',
        trip.driverName || '',
        trip.licensePlate || '',
        trip.time || '',
        trip.date || '',
        String(trip.price || ''),
        tripVehicle?.type || '',
        tripRoute?.departurePoint || '',
        tripRoute?.arrivalPoint || '',
        tripRoute?.details || '',
        tripRoute?.note || '',
      ].join(' ');
      if (!matchesSearch(searchable, p.freeSearch)) return false;
    }
    // Category filter: only show trips whose route matches the selected category.
    if (effectiveCategoryFilter) {
      if (!tripRoute || tripRoute.routeCategory !== effectiveCategoryFilter) return false;
    }
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
          // Prefer exact name match; fall back to substring/accent-folded match.
          // This prevents "Bến Viềng Cát Bà" from matching a search for "Cát Bà"
          // (substring match) when an exact stop named "Cát Bà" exists later in the route.
          let fromIdx = orderedStops.findIndex(name => name === effectiveFrom);
          if (fromIdx === -1) fromIdx = orderedStops.findIndex(name =>
            matchesSearch(name, effectiveFrom) || matchesSearch(effectiveFrom, name));
          if (fromIdx === -1) return false;
          if (effectiveTo) {
            let toIdx = orderedStops.findIndex(name => name === effectiveTo);
            if (toIdx === -1) toIdx = orderedStops.findIndex(name =>
              matchesSearch(name, effectiveTo) || matchesSearch(effectiveTo, name));
            if (toIdx === -1 || fromIdx >= toIdx) return false;
          }
        } else {
          let toIdx = orderedStops.findIndex(name => name === effectiveTo);
          if (toIdx === -1) toIdx = orderedStops.findIndex(name =>
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
    if (p.priceMinVal) {
      const minVal = parseInt(p.priceMinVal);
      if (!isNaN(minVal) && trip.price < minVal) return false;
    }
    if (p.priceMaxVal) {
      const maxVal = parseInt(p.priceMaxVal);
      if (!isNaN(maxVal) && trip.price > maxVal) return false;
    }
    // Time-range filter: HH:MM strings compare correctly lexicographically
    // (e.g. '06:00' < '14:30' < '23:59'), so a direct string comparison is safe.
    if (p.timeFrom && trip.time && trip.time < p.timeFrom) return false;
    if (p.timeTo && trip.time && trip.time > p.timeTo) return false;
    const totalPassengers = p.adults + p.children;
    const emptySeats = (trip.seats || []).filter(s => s.status === SeatStatus.EMPTY).length;
    // For RUNNING trips, skip seat availability check (no open booking slots).
    if (trip.status === TripStatus.WAITING && emptySeats < totalPassengers) return false;
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
    // Snapshot the current input values as committed params so that filterTrip and
    // the segmentFares effect use a stable set of values (not live-updating on keystrokes).
    const newParams = {
      from: searchFrom, to: searchTo,
      stationFrom: searchStationFrom, stationTo: searchStationTo,
      date: searchDate, returnDate: searchReturnDate,
      adults: searchAdults, children: searchChildren,
      priceMinVal: priceMin, priceMaxVal: priceMax,
      timeFrom: searchTimeFrom, timeTo: searchTimeTo,
      freeSearch: bookTicketSearch,
    };
    setCommittedParams(newParams);
    setHasSearched(true);
    // When the search includes from/to, segment fares need to be re-fetched asynchronously for the
    // new route. Computing the count right now would use the stale segmentFares from the previous
    // search (React state updates are async), which would incorrectly exclude trips whose route
    // wasn't in the old fare map and show a false "no trips found" notification. Instead we set a
    // flag and let the segmentFaresLoaded useEffect show the notification once fares are ready.
    const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
    const effFrom = isReturnPhase ? (newParams.stationTo || newParams.to) : (newParams.stationFrom || newParams.from);
    const effTo = isReturnPhase ? (newParams.stationFrom || newParams.from) : (newParams.stationTo || newParams.to);
    if (effFrom && effTo) {
      // Defer notification until segment fares finish loading (handled by the useEffect below).
      pendingNotificationRef.current = true;
    } else {
      // No segment fare filter will be applied (from/to not specified), so count now directly.
      const vehicleMap = new Map(vehicles.map(v => [v.licensePlate, v]));
      const count = allTrips.filter(trip => {
        if (!filterTrip(trip, true, newParams)) return false;
        if (localVehicleCombo) {
          const v = vehicleMap.get(trip.licensePlate);
          if (comboType && v?.type !== comboType) return false;
          if (comboSeats > 0 && v?.seats !== comboSeats) return false;
        }
        return true;
      }).length;
      if (count > 0) {
        showToast(t.search_results_found.replace('{count}', String(count)), 'success');
      } else {
        showToast(t.no_trips_found, 'info');
      }
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
    // Suggestions are always revealed; search results require the search button to have been clicked.
    const isTripRevealed = isSuggestion || hasSearched || clearedTripCards.has(trip.id);
    const tripVehicle = vehicles.find(v => v.licensePlate === trip.licensePlate);
    const emptySeats = (trip.seats || []).filter(s => s.status === SeatStatus.EMPTY).length;
    const cardBg = getRouteCardBg(trip.route || '');
    const isRunning = trip.status === TripStatus.RUNNING;
    const isLiked = likedTrips.has(trip.id);
    // TOUR_SHORT: addons are shown inline on the card with checkboxes
    const isTourShort = tripRoute?.routeCategory === 'TOUR_SHORT';
    const tripSelectedAddons = isTourShort ? (selectedAddonsByTrip[trip.id] || []) : [];
    const selectedAddonTotal = (trip.addons || [])
      .filter(a => tripSelectedAddons.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);
    return (
      <div key={trip.id} className={cn(cardBg, "rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col", isSuggestion ? "border-amber-200 opacity-95" : isRunning ? "border-blue-200" : "border-gray-100")}>
        {/* Route name + favourite button – full-width header row */}
        <div className="px-3 pt-2.5 pb-1 flex items-center gap-1">
          <span aria-label={`Tuyến: ${trip.route}`} className="px-2 py-0.5 bg-daiichi-accent text-daiichi-red rounded-full text-[11px] font-bold uppercase flex-1 text-center truncate">{trip.route}</span>
          {isRunning && (
            <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-bold whitespace-nowrap">
              🚌 {t.running_trip_label || 'Đang chạy'}
            </span>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleLikedTrip(trip.id); }}
            aria-label={isLiked ? (t.remove_from_favourites || 'Bỏ yêu thích') : (t.add_to_favourites || 'Thêm vào yêu thích')}
            className={cn("flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-all", isLiked ? "text-red-500 bg-red-50 hover:bg-red-100" : "text-gray-300 hover:text-red-400 hover:bg-red-50")}
          >
            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={2} />
          </button>
        </div>
        {/* 3-column body: [image | schedule info | seats+price+CTA] */}
        {/* Mobile: image full-width on top row, info columns side by side below */}
        {/* Desktop (md+): all 3 columns side by side */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1.5fr_1.5fr] gap-2 px-2 pb-2">
          {/* Column 1: Large route image – full width on mobile, proportional column on desktop */}
          <div
            className="col-span-2 md:col-span-1 relative overflow-hidden rounded-2xl aspect-video md:aspect-auto md:min-h-[110px]"
            onTouchStart={e => { cardSwipeTouchX.current[trip.id] = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const startX = cardSwipeTouchX.current[trip.id] ?? 0;
              const dx = e.changedTouches[0].clientX - startX;
              if (Math.abs(dx) > 40 && isTripRevealed && routeImages.length > 1) {
                setTripCardImgIdx(prev => {
                  const cur = prev[trip.id] ?? 0;
                  const newIdx = dx < 0
                    ? (cur + 1) % routeImages.length
                    : (cur - 1 + routeImages.length) % routeImages.length;
                  return { ...prev, [trip.id]: newIdx };
                });
              }
            }}
          >
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
                {/* Click-to-open lightbox button (shown on revealed images) */}
                {isTripRevealed && currentImg && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setLightboxState({ tripId: trip.id, imgIdx: carouselIdx }); }}
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all z-10"
                    aria-label={language === 'vi' ? 'Xem ảnh to' : language === 'ja' ? '大きい画像を見る' : 'View full image'}
                  >
                    <ZoomIn size={12} />
                  </button>
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
            {/* Add-ons list – show each service name + price (non-TOUR_SHORT only) */}
            {!isTourShort && (trip.addons || []).length > 0 && (
              <div className="space-y-0.5 self-start">
                {(trip.addons || []).map(addon => (
                  <button
                    key={addon.id}
                    onClick={() => setShowAddonDetailTrip(trip)}
                    aria-label={language === 'vi' ? 'Xem chi tiết dịch vụ kèm theo' : language === 'ja' ? '付帯サービスの詳細を見る' : 'View add-on services details'}
                    className="flex items-start gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer w-full"
                  >
                    <Gift size={9} className="flex-shrink-0 mt-0.5" />
                    <span className="break-words leading-tight min-w-0 flex-1">{addon.name}</span>
                    <span className="flex-shrink-0 text-emerald-600">+{addon.price.toLocaleString()}đ</span>
                  </button>
                ))}
              </div>
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
                // For TOUR_SHORT: add the total price of selected add-ons to the displayed price
                const displayedPrice = discountedPrice + selectedAddonTotal;

                if (isAgent && agentBase !== null) {
                  return (
                    <div>
                      <p className="text-sm font-bold text-daiichi-red leading-tight">{displayedPrice.toLocaleString()}đ</p>
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
                    <p className="text-sm font-bold text-daiichi-red leading-tight">{displayedPrice.toLocaleString()}đ</p>
                    <p className="text-[9px] text-gray-400 line-through">{retailBase.toLocaleString()}đ</p>
                    <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                      🏷️ -{discountPct}%
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-daiichi-red leading-tight">{displayedPrice.toLocaleString()}đ</p>
                );
              })()}
            </div>
            {/* Select seat CTA – moved to card footer (below) */}
          </div>
        </div>
        {/* TOUR_SHORT: inline add-on selector – shown directly on the card */}
        {isTourShort && (trip.addons || []).length > 0 && (
          <div className="px-3 pb-2 pt-1 border-t border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 mb-1.5">
              <Gift size={9} />
              {language === 'vi' ? 'Dịch vụ kèm theo' : language === 'ja' ? '付帯サービス' : 'Add-on Services'}
            </p>
            <div className="space-y-1">
              {(trip.addons || []).map((addon) => {
                const isAddonSelected = tripSelectedAddons.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-xl border cursor-pointer transition-colors select-none',
                      isAddonSelected
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-gray-50 border-gray-100 hover:bg-emerald-50/50 hover:border-emerald-200'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isAddonSelected}
                      onChange={() => toggleAddon(trip.id, addon.id)}
                      className="accent-emerald-600 w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-800 truncate">{addon.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-daiichi-red whitespace-nowrap">+{addon.price.toLocaleString()}đ</span>
                    {(addon.description || (addon.images && addon.images.length > 0)) && (
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setShowSingleAddonDetail(addon as TripAddon); }}
                        aria-label={language === 'vi' ? 'Xem chi tiết' : language === 'ja' ? '詳細を見る' : 'View details'}
                        className="flex-shrink-0 p-0.5 text-emerald-600 hover:text-emerald-800 transition-colors"
                      >
                        <Info size={13} />
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {/* Footer: departure → destination */}
        {(() => {
          const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
          // Prefer specific stop selection over plain city text when available
          const effectiveFrom = (isReturnPhase ? (searchStationTo || searchTo) : (searchStationFrom || searchFrom)) || tripRoute?.departurePoint || '';
          const effectiveTo = (isReturnPhase ? (searchStationFrom || searchFrom) : (searchStationTo || searchTo)) || tripRoute?.arrivalPoint || '';
          if (!effectiveFrom && !effectiveTo) return null;

          // Calculate departure time (base trip time + departure offset)
          const depOffsetMins = ((): number => {
            if (!trip.time) return 0;
            // If the passenger is boarding at an intermediate stop, use that stop's offset
            const matchedStop = tripRoute?.routeStops?.find(s =>
              effectiveFrom && (s.stopName === effectiveFrom || matchesSearch(s.stopName, effectiveFrom))
            );
            if (matchedStop) return matchedStop.offsetMinutes ?? 0;
            // Departure point: use route's departureOffsetMinutes
            return tripRoute?.departureOffsetMinutes ?? 0;
          })();

          const calcTime = (base: string, offsetMins: number): string => {
            const [h, m] = base.split(':').map(Number);
            if (isNaN(h) || isNaN(m)) return base;
            const total = h * 60 + m + offsetMins;
            return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
          };

          // Calculate arrival time using route's arrivalOffsetMinutes
          const arrOffsetMins = ((): number | null => {
            if (!trip.time) return null;
            // Determine whether effectiveTo is the route's final arrival point.
            // When it is, we should NOT use a routeStop offset (which is only for
            // intermediate fare-pricing stops and may be stale/incorrect), and
            // instead rely on the authoritative route-level arrivalOffsetMinutes or
            // the human-readable duration string.
            const arrPt = tripRoute?.arrivalPoint || '';
            const isFinalDestination = Boolean(
              arrPt && effectiveTo &&
              // Check both directions because matchesSearch() normalises accents and
              // whitespace, so "Cat Ba" should match "Cát Bà" regardless of which
              // string is passed as the query vs. the candidate.
              (arrPt === effectiveTo ||
                matchesSearch(arrPt, effectiveTo) ||
                matchesSearch(effectiveTo, arrPt))
            );

            if (!isFinalDestination) {
              // Intermediate stop: use the stop's own time offset
              const matchedArrStop = tripRoute?.routeStops?.find(s =>
                effectiveTo && (s.stopName === effectiveTo || matchesSearch(s.stopName, effectiveTo))
              );
              if (matchedArrStop && (matchedArrStop.offsetMinutes ?? 0) > 0) return matchedArrStop.offsetMinutes ?? 0;
            }

            // For the final destination (or an intermediate stop not found in routeStops):
            // 1. Prefer the explicit route-level arrival offset
            const routeArrOffset = tripRoute?.arrivalOffsetMinutes ?? 0;
            if (routeArrOffset > 0) return routeArrOffset;

            // 2. Fall back to parsing the human-readable duration string
            if (tripRoute?.duration) {
              const parsed = parseDurationToMinutes(tripRoute.duration);
              if (parsed && parsed > 0) return parsed;
            }

            // 3. Last resort: use a routeStop offset even for the final destination
            const matchedArrStop = tripRoute?.routeStops?.find(s =>
              effectiveTo && (s.stopName === effectiveTo || matchesSearch(s.stopName, effectiveTo))
            );
            if (matchedArrStop && (matchedArrStop.offsetMinutes ?? 0) > 0) return matchedArrStop.offsetMinutes ?? 0;

            return null;
          })();

          const depTime = trip.time ? calcTime(trip.time, depOffsetMins) : null;
          const arrTime = trip.time && arrOffsetMins !== null ? calcTime(trip.time, arrOffsetMins) : null;

          return (
            <div className="px-3 pb-2.5 border-t border-gray-100 pt-1.5 mt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-stretch gap-2 min-w-0 flex-1">
                  <div className="flex flex-col items-center flex-shrink-0 mt-0.5" aria-hidden="true">
                    <div className="w-1.5 h-1.5 rounded-full bg-daiichi-red" />
                    <div className="w-px flex-1 bg-gray-200 my-0.5" />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {depTime && (
                        <span className="text-[10px] font-bold text-blue-600 flex-shrink-0">{depTime}</span>
                      )}
                      <span
                        className="text-[10px] font-semibold text-gray-700 leading-tight line-clamp-1"
                        aria-label={`${language === 'vi' ? 'Điểm đi' : language === 'ja' ? '出発地' : 'From'}: ${effectiveFrom || '—'}`}
                      >
                        {effectiveFrom || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {arrTime && (
                        <span className="text-[10px] font-bold text-blue-400 flex-shrink-0">{arrTime}</span>
                      )}
                      <span
                        className="text-[10px] font-medium text-gray-500 leading-tight line-clamp-1"
                        aria-label={`${language === 'vi' ? 'Điểm đến' : language === 'ja' ? '目的地' : 'To'}: ${effectiveTo || '—'}`}
                      >
                        {effectiveTo || '—'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* CTA button – inline with itinerary footer */}
                {(() => {
                  if (isRunning) {
                    return (
                      <button
                        onClick={() => showToast(t.running_trip_contact_msg || 'Chuyến này đang chạy. Vui lòng liên hệ đại lý để đặt vé.', 'info')}
                        className="flex-shrink-0 px-2 py-1 bg-blue-500 text-white rounded-lg text-[9px] font-bold whitespace-nowrap"
                      >
                        🚌 {t.contact_agency_to_book || 'Liên hệ đại lý'}
                      </button>
                    );
                  }
                  if (trip.isMerged) {
                    return (
                      <button
                        onClick={() => alert(language === 'vi'
                          ? 'Chuyến này đã được ghép lại. Vui lòng liên hệ nhà xe để đặt chỗ.'
                          : language === 'ja'
                            ? 'この便は統合されました。座席予約はバス会社にお問い合わせください。'
                            : 'This trip has been merged. Please contact the bus company to book.')}
                        className="flex-shrink-0 px-2 py-1 bg-orange-400 text-white rounded-lg text-[9px] font-bold whitespace-nowrap cursor-not-allowed"
                      >
                        🔗 {language === 'vi' ? 'Liên hệ nhà xe' : language === 'ja' ? 'バス会社' : 'Contact Co.'}
                      </button>
                    );
                  }
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
                        let isoDate: string;
                        if (tripDateStr.includes('/')) {
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
                      className="flex-shrink-0 px-2 py-1 bg-gray-400 text-white rounded-lg text-[9px] font-bold whitespace-nowrap cursor-not-allowed"
                    >
                      🔒 {language === 'vi' ? 'Liên hệ đại lý' : language === 'ja' ? '代理店' : 'Contact'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setPendingConfirmTrip(trip)}
                      className="flex-shrink-0 px-2.5 py-1 bg-daiichi-red text-white rounded-lg text-[9px] font-bold whitespace-nowrap shadow shadow-daiichi-red/20"
                    >
                      {t.view_details || 'Xem chi tiết'} →
                    </button>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // Handler called when user confirms in TripConfirmPanel
  const handleTripConfirm = () => {
    if (!pendingConfirmTrip) return;
    // Navigate to seat mapping; pickup/dropoff carry over from search params via App.tsx
    setSelectedTrip(pendingConfirmTrip);
    // Preserve the correct "back" tab: tours tab for TOUR_SHORT, otherwise book-ticket
    const tripRoute = routes.find(r => r.name === pendingConfirmTrip.route);
    setPreviousTab(tripRoute?.routeCategory === 'TOUR_SHORT' ? 'tours' : 'book-ticket');
    // Pre-populate addon quantities for TOUR_SHORT: selected addons × total passengers
    if (setAddonQuantities) {
      if (tripRoute?.routeCategory === 'TOUR_SHORT') {
        const selectedAddonsForTrip = selectedAddonsByTrip[pendingConfirmTrip.id] || [];
        const totalPassengers = searchAdults + searchChildren;
        const initialQtys: Record<string, number> = {};
        selectedAddonsForTrip.forEach(addonId => { initialQtys[addonId] = totalPassengers; });
        setAddonQuantities(initialQtys);
      } else {
        setAddonQuantities({});
      }
    }
    setActiveTab('seat-mapping');
    setPendingConfirmTrip(null);
  };

  return (
    <>
    {/* Image lightbox overlay */}
    {lightboxState && (() => {
      const lbTrip = allTrips.find(t => t.id === lightboxState.tripId);
      const lbRoute = lbTrip ? routes.find(r => r.name === lbTrip.route) : undefined;
      const lbImages = (lbRoute?.images && lbRoute.images.length > 0) ? lbRoute.images : (lbRoute?.imageUrl ? [lbRoute.imageUrl] : []);
      if (lbImages.length === 0) return null;
      const lbIdx = lightboxState.imgIdx;
      const goPrev = () => setLightboxState(s => s ? { ...s, imgIdx: (s.imgIdx - 1 + lbImages.length) % lbImages.length } : null);
      const goNext = () => setLightboxState(s => s ? { ...s, imgIdx: (s.imgIdx + 1) % lbImages.length } : null);
      return (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxState(null)}
          onTouchStart={e => { lightboxTouchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - lightboxTouchX.current;
            if (Math.abs(dx) > 50) {
              if (dx < 0) {
                goNext();
              } else {
                goPrev();
              }
            }
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
            else if (e.key === 'Escape') setLightboxState(null);
          }}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label={language === 'vi' ? 'Xem ảnh' : 'View image'}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightboxState(null)}
            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all"
            aria-label={language === 'vi' ? 'Đóng' : 'Close'}
          ><X size={18} /></button>
          {/* Prev */}
          {lbImages.length > 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); goPrev(); }}
              className="absolute left-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all text-xl"
              aria-label="Previous"
            >‹</button>
          )}
          {/* Image */}
          <img
            src={lbImages[lbIdx]}
            alt={lbTrip?.route ?? ''}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            onClick={e => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
          {/* Next */}
          {lbImages.length > 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); goNext(); }}
              className="absolute right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all text-xl"
              aria-label="Next"
            >›</button>
          )}
          {/* Dots */}
          {lbImages.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {lbImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={e => { e.stopPropagation(); setLightboxState(s => s ? { ...s, imgIdx: i } : null); }}
                  className={cn('w-2 h-2 rounded-full transition-all', i === lbIdx ? 'bg-white' : 'bg-white/40')}
                  aria-label={`Ảnh ${i + 1}`}
                />
              ))}
            </div>
          )}
          {/* Counter */}
          {lbImages.length > 1 && (
            <div className="absolute top-4 left-4 z-10 px-2 py-0.5 bg-black/40 text-white text-xs rounded-full">
              {lbIdx + 1} / {lbImages.length}
            </div>
          )}
        </div>
      );
    })()}
    {/* TripConfirmPanel – full-screen overlay shown when user clicks a trip card */}
    {pendingConfirmTrip && (
      <TripConfirmPanel
        trip={pendingConfirmTrip}
        route={routes.find(r => r.name === pendingConfirmTrip.route)}
        language={language}
        segmentFares={segmentFares}
        searchStationFrom={searchStationFrom}
        searchStationTo={searchStationTo}
        searchFrom={searchFrom}
        searchTo={searchTo}
        roundTripPhase={roundTripPhase}
        tripType={tripType}
        currentUser={currentUser}
        searchAdults={searchAdults}
        searchChildren={searchChildren}
        searchChildrenAges={searchChildrenAges}
        selectedAddons={selectedAddonsByTrip[pendingConfirmTrip.id] || []}
        onConfirm={handleTripConfirm}
        onClose={() => setPendingConfirmTrip(null)}
      />
    )}
    <div className="space-y-8">
      <div className="bg-white p-2 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-6">
          <h2 className="text-base sm:text-2xl font-bold truncate">{t.search_title}</h2>
          {effectiveCategoryFilter !== 'TOUR_SHORT' && (
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
          )}
        </div>
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-4", tripType === 'ROUND_TRIP' ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {/* FROM + TO combined cell with swap button overlaid between inputs */}
          <div className="lg:col-span-2">
            {effectiveCategoryFilter === 'TOUR_SHORT' ? (
              /* TOUR_SHORT: keyword search input instead of FROM/TO stops */
              <div>
                <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.keyword_search}</label>
                <div className="relative sm:mt-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <input
                    type="text"
                    value={bookTicketSearch}
                    onChange={e => setBookTicketSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                    placeholder={t.tour_keyword_search_placeholder}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl focus:outline-none focus:border-daiichi-red focus:ring-2 focus:ring-daiichi-red/20"
                  />
                </div>
              </div>
            ) : (
              /* Default: FROM and TO stop search inputs */
              <div className="relative flex flex-col sm:flex-row gap-2 sm:gap-2 min-w-0">
              {/* FROM input card */}
              <div className="flex-1 min-w-0 bg-gray-50 sm:bg-transparent border-2 border-daiichi-red/30 sm:border-0 rounded-2xl sm:rounded-none sm:p-0">
                <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.from}</label>
                <div className="sm:mt-1">
                  <StopSearchInput
                    grouped="top"
                    value={searchFrom}
                    terminalValue={searchStationFrom}
                    stops={filteredStops}
                    placeholder={isMobile ? t.stop_search_from_placeholder_mobile : (t.stop_search_from_placeholder || t.from)}
                    nearestHint={t.stop_search_nearest_hint}
                    mustSelectError={t.stop_search_must_select}
                    onChange={handleFromChange}
                    onConfirmed={() => toStopRef.current?.focus()}
                    stopPickerMatchingLabel={t.stop_picker_matching}
                    stopPickerAllLabel={t.stop_picker_all}
                    stopPickerCloseLabel={t.stop_picker_close}
                    stopPickerNoStopsLabel={t.stop_picker_no_stops}
                  />
                </div>
              </div>
              {/* TO input card */}
              <div className="flex-1 min-w-0 bg-gray-50 sm:bg-transparent border-2 border-blue-300/60 sm:border-0 rounded-2xl sm:rounded-none sm:p-0">
                <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.to}</label>
                <div className="sm:mt-1">
                  <StopSearchInput
                    ref={toStopRef}
                    grouped="top"
                    value={searchTo}
                    terminalValue={searchStationTo}
                    stops={filteredStops}
                    placeholder={isMobile ? t.stop_search_to_placeholder_mobile : (t.stop_search_to_placeholder || t.to)}
                    nearestHint={t.stop_search_nearest_hint}
                    mustSelectError={t.stop_search_must_select}
                    onChange={handleToChange}
                    stopPickerMatchingLabel={t.stop_picker_matching}
                    stopPickerAllLabel={t.stop_picker_all}
                    stopPickerCloseLabel={t.stop_picker_close}
                    stopPickerNoStopsLabel={t.stop_picker_no_stops}
                  />
                </div>
              </div>
              {/* Mobile swap button: absolutely positioned to overlap FROM and TO, ~1cm from right */}
              <button
                type="button"
                onClick={handleSwap}
                title={t.swap_from_to || 'Đổi điểm đi và điểm đến'}
                className="sm:hidden absolute right-10 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full border-2 border-daiichi-red/60 bg-white text-daiichi-red shadow hover:border-daiichi-red hover:bg-daiichi-red/10 transition-all"
              >
                <ArrowUpDown size={15} strokeWidth={2.5} />
              </button>
              {/* Swap button for desktop (sm+): absolutely positioned between FROM and TO, rotated 90° */}
              <button
                type="button"
                onClick={handleSwap}
                title={t.swap_from_to || 'Đổi điểm đi và điểm đến'}
                className="hidden sm:flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full border-2 border-daiichi-red/60 bg-white text-daiichi-red shadow hover:border-daiichi-red hover:bg-daiichi-red/10 transition-all z-10 rotate-90"
              >
                <ArrowUpDown size={15} strokeWidth={2.5} />
              </button>
              </div>
            )}
          </div>
          {/* Date fields: on mobile show as 2 equal columns when ROUND_TRIP */}
          {tripType === 'ROUND_TRIP' ? (
            <div className="grid grid-cols-2 gap-1.5 sm:contents">
              <div>
                <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.departure_date}</label>
                <div className="relative mt-0 sm:mt-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <span className="sm:hidden absolute left-12 top-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">{t.departure_date}</span>
                  <input type="date" value={searchDate} min={getLocalDateString(0)} onChange={e => { setSearchDate(e.target.value); }} className="w-full pl-12 pr-4 pt-7 pb-2 sm:py-4 bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl focus:outline-none focus:border-daiichi-red focus:ring-2 focus:ring-daiichi-red/20" />
                </div>
              </div>
              <div>
                <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.return_date}</label>
                <div className="relative mt-0 sm:mt-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <span className="sm:hidden absolute left-12 top-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">{t.return_date}</span>
                  <input type="date" value={searchReturnDate} min={searchDate || getLocalDateString(0)} onChange={e => { setSearchReturnDate(e.target.value); }} className="w-full pl-12 pr-4 pt-7 pb-2 sm:py-4 bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl focus:outline-none focus:border-daiichi-red focus:ring-2 focus:ring-daiichi-red/20" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1">{t.departure_date}</label>
              <div className="relative mt-0 sm:mt-1">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <span className="sm:hidden absolute left-12 top-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">{t.departure_date}</span>
                <input type="date" value={searchDate} min={getLocalDateString(0)} onChange={e => { setSearchDate(e.target.value); }} className="w-full pl-12 pr-4 pt-7 pb-2 sm:py-4 bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl focus:outline-none focus:border-daiichi-red focus:ring-2 focus:ring-daiichi-red/20" />
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
        {/* Passenger count row + vehicle/seat filters + search button */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-1.5 sm:gap-3 mt-1.5 sm:mt-4">
          <div className="flex-1 sm:flex-none grid grid-cols-2 gap-2 sm:gap-4 sm:mt-4 sm:w-64">
            <div>
              <label className="hidden sm:block text-[10px] font-bold text-gray-700 uppercase tracking-widest ml-1 truncate">{t.num_adults}</label>
              <div className="relative sm:mt-1 flex items-center bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl overflow-hidden transition-colors">
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
              <div className="relative sm:mt-1 flex items-center bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl overflow-hidden transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setSearchChildren(v => Math.max(0, v - 1));
                    setSearchChildrenAges(prev => prev.slice(0, Math.max(0, prev.length - 1)));
                  }}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >−</button>
                <div className="w-full flex flex-col items-center px-8 sm:px-10 py-2 sm:py-3">
                  <span className="text-[10px] sm:hidden font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{t.num_children}</span>
                  <input
                    type="number"
                    min="0"
                    value={searchChildren === 0 ? '' : searchChildren}
                    onChange={e => {
                      const n = Math.max(0, parseInt(e.target.value) || 0);
                      setSearchChildren(n);
                      setSearchChildrenAges(prev => Array.from({ length: n }, (_, i) => prev[i]));
                    }}
                    placeholder="0"
                    className="w-full text-center bg-transparent focus:outline-none font-bold text-gray-700 text-sm leading-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchChildren(v => v + 1);
                    setSearchChildrenAges(prev => [...prev, undefined]);
                  }}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-daiichi-red hover:text-white text-gray-600 font-bold text-sm transition-colors z-10"
                >+</button>
              </div>
            </div>
          </div>
          {/* Children age inputs – shown when at least one child is selected */}
          {searchChildren > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                {language === 'vi' ? 'Tuổi trẻ em (năm)' : language === 'ja' ? 'お子様の年齢（歳）' : 'Children ages (years)'}
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: searchChildren }, (_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                      {language === 'vi' ? `Bé ${i + 1}:` : language === 'ja' ? `子${i + 1}:` : `Child ${i + 1}:`}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="17"
                      placeholder={language === 'vi' ? 'tuổi' : language === 'ja' ? '歳' : 'age'}
                      value={searchChildrenAges[i] === undefined ? '' : searchChildrenAges[i]}
                      onChange={e => {
                        const parsed = parseInt(e.target.value, 10);
                        const age = e.target.value === '' ? undefined : (isNaN(parsed) ? undefined : Math.max(0, Math.min(17, parsed)));
                        setSearchChildrenAges(prev => {
                          const updated = [...prev];
                          updated[i] = age;
                          return updated;
                        });
                      }}
                      className="w-16 px-2 py-1 text-center text-sm font-bold bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-amber-600">
                {language === 'vi' ? '• Trẻ dưới 4 tuổi: miễn phí (không cần ghế). Trẻ từ 4 tuổi trở lên: tính giá người lớn.' : language === 'ja' ? '• 4歳未満：無料（座席不要）。4歳以上：大人料金。' : '• Under 4: free (no seat needed). Age 4+: adult fare.'}
              </p>
            </div>
          )}
          {/* Combined vehicle type + seat count filter */}
          <div className="flex items-center gap-2 sm:items-end sm:mt-4">
            <div className="flex-1 min-w-0 shrink">
              <select
                value={localVehicleCombo}
                onChange={e => setLocalVehicleCombo(e.target.value)}
                className="w-full px-2 py-[13px] bg-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10 transition-colors"
              >
                <option value="">{language === 'vi' ? 'Loại xe & Số ghế' : language === 'ja' ? '車種・座席数' : 'Type & Seats'}</option>
                {availableCombinations.map(combo => (
                  <option key={`${combo.type}::${combo.seats}`} value={`${combo.type}::${combo.seats}`}>
                    {combo.label}
                  </option>
                ))}
              </select>
            </div>
            {localVehicleCombo && (
              <button
                onClick={() => setLocalVehicleCombo('')}
                className="flex items-center self-end px-2.5 py-[13px] rounded-2xl text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                title={t.reset_filter || 'Xóa bộ lọc'}
                aria-label={t.reset_filter || 'Xóa bộ lọc'}
              >
                ✕
              </button>
            )}
          </div>
          {/* Search button – full width on mobile, auto on sm+ */}
          <div className="sm:shrink-0 sm:ml-auto sm:flex sm:mt-4 flex gap-2">
            <button
              onClick={() => setShowAdvancedFilter(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 sm:py-4 rounded-2xl text-sm font-bold transition-all border-2",
                advHasFilters
                  ? "bg-daiichi-red/10 text-daiichi-red border-daiichi-red/40"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
              )}
              title={language === 'vi' ? 'Lọc nâng cao' : 'Advanced filter'}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline whitespace-nowrap">{language === 'vi' ? 'Lọc nâng cao' : 'Advanced filter'}</span>
              {advHasFilters && <span className="w-2 h-2 rounded-full bg-daiichi-red flex-shrink-0" />}
            </button>
            <button
              onClick={handleSearch}
              className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-4 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap bg-daiichi-red shadow-daiichi-red/20 hover:scale-[1.02]"
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

        {/* Suggestions section: shown before the first search (liked trips + discounted trips) */}
        {!hasSearched && (() => {
          const eligibleStatuses = [TripStatus.WAITING, TripStatus.RUNNING];
          const matchesCategory = (tr: Trip) => {
            if (!effectiveCategoryFilter) return true;
            const route = routeByName.get(tr.route);
            return !!route && route.routeCategory === effectiveCategoryFilter;
          };
          const likedSuggestions = allTrips.filter(tr => likedTrips.has(tr.id) && eligibleStatuses.includes(tr.status) && matchesCategory(tr));
          const discountedSuggestions = allTrips.filter(tr =>
            !likedTrips.has(tr.id) &&
            (tr.discountPercent || 0) > 0 &&
            eligibleStatuses.includes(tr.status) &&
            matchesCategory(tr)
          );
          const allSuggestions = [...likedSuggestions, ...discountedSuggestions];
          if (allSuggestions.length === 0) return null;
          return (
            <div className="space-y-4">
              <h3 className="text-base font-bold px-2 text-amber-700">{t.trip_suggestions_title || '✨ Gợi ý cho bạn'}</h3>
              {likedSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-red-500 px-1">{t.liked_trips_title || '❤️ Xe bạn yêu thích'}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {likedSuggestions.map(tr => renderTripCard(tr, true))}
                  </div>
                </div>
              )}
              {discountedSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-green-600 px-1">{t.discounted_trips_title || '🏷️ Xe đang giảm giá'}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {discountedSuggestions.map(tr => renderTripCard(tr, true))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {hasSearched && (() => {
          const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
          const effectiveFrom = isReturnPhase ? (committedParams?.to || '') : (committedParams?.from || '');
          const effectiveTo = isReturnPhase ? (committedParams?.from || '') : (committedParams?.to || '');
          const effectiveDate = isReturnPhase ? (committedParams?.returnDate || '') : (committedParams?.date || '');

          const filteredBookingTrips = (() => {
            const vehicleMap = new Map(vehicles.map(v => [v.licensePlate, v]));
            let result = allTrips.filter(tr => {
              if (!filterTrip(tr, true)) return false;
              if (localVehicleCombo) {
                const v = vehicleMap.get(tr.licensePlate);
                if (comboType && v?.type !== comboType) return false;
                if (comboSeats > 0 && v?.seats !== comboSeats) return false;
              }
              // Advanced time slot filter
              if (advTimeSlots.size > 0) {
                const inAnySlot = [...advTimeSlots].some((slot: string) => tripInTimeSlot(tr.time || '', slot));
                if (!inAnySlot) return false;
              }
              return true;
            });
            // Advanced sort
            if (advSortBy === 'price_asc') {
              result = result.sort((a, b) => (a.price || 0) - (b.price || 0));
            } else if (advSortBy === 'price_desc') {
              result = result.sort((a, b) => (b.price || 0) - (a.price || 0));
            } else if (advSortBy === 'time_asc') {
              result = result.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            } else if (advSortBy === 'time_desc') {
              result = result.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
            } else if (advSortBy === 'duration_asc') {
              result = result.sort((a, b) => {
                const rA = routeByName.get(a.route);
                const rB = routeByName.get(b.route);
                const dA = rA?.duration ? (parseDurationToMinutes(rA.duration) ?? 99999) : 99999;
                const dB = rB?.duration ? (parseDurationToMinutes(rB.duration) ?? 99999) : 99999;
                return dA - dB;
              });
            } else {
              result = result.sort((a, b) => compareTripDateTime(a, b));
            }
            return result;
          })();

          // Nearest trips: same route/direction but without date restriction, sorted by date proximity
          const nearestTrips = filteredBookingTrips.length === 0 && (effectiveFrom || effectiveTo)
            ? allTrips
                .filter(tr => filterTrip(tr, false))
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredBookingTrips.map(trip => renderTripCard(trip, false))}
                </div>
                {/* Load all trips button shown at bottom of results */}
                {!allTripsLoaded && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleLoadAllTrips}
                      disabled={loadingAllTrips}
                      className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow"
                    >
                      {loadingAllTrips ? <LoaderIcon size={16} className="animate-spin" /> : <DatabaseZap size={16} />}
                      {loadingAllTrips
                        ? (language === 'vi' ? `Đang tải... ${loadedTripCount} chuyến` : `Loading... ${loadedTripCount} trips`)
                        : (language === 'vi' ? 'Tải tất cả chuyến' : 'Load all trips')}
                    </button>
                  </div>
                )}
                {allTripsLoaded && (
                  <p className="text-center text-xs text-gray-400 pt-1">
                    {language === 'vi' ? `Đã hiển thị tất cả ${allTrips.length} chuyến` : `Showing all ${allTrips.length} trips`}
                  </p>
                )}
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
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl">
                  <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm font-bold text-gray-800">{t.no_exact_trips}</p>
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
                  {!allTripsLoaded && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-3">
                        {language === 'vi' ? 'Có thể có nhiều chuyến hơn trong cơ sở dữ liệu.' : 'There may be more trips in the database.'}
                      </p>
                      <button
                        onClick={handleLoadAllTrips}
                        disabled={loadingAllTrips}
                        className="flex items-center gap-2 mx-auto bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow mb-3"
                      >
                        {loadingAllTrips ? <LoaderIcon size={16} className="animate-spin" /> : <DatabaseZap size={16} />}
                        {loadingAllTrips
                          ? (language === 'vi' ? `Đang tải... ${loadedTripCount} chuyến` : `Loading... ${loadedTripCount} trips`)
                          : (language === 'vi' ? 'Tải tất cả chuyến' : 'Load all trips')}
                      </button>
                    </div>
                  )}
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
      {/* Single addon detail modal – shown when user clicks ℹ on a TOUR_SHORT addon */}
      {showSingleAddonDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSingleAddonDetail(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="single-addon-detail-title" className="bg-white rounded-[32px] p-6 max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Gift size={20} className="text-emerald-600" />
                <h3 id="single-addon-detail-title" className="text-lg font-bold text-emerald-700">{showSingleAddonDetail.name}</h3>
              </div>
              <button onClick={() => setShowSingleAddonDetail(null)} aria-label={language === 'vi' ? 'Đóng' : language === 'ja' ? '閉じる' : 'Close'} className="p-2 hover:bg-gray-50 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-daiichi-red whitespace-nowrap">+{showSingleAddonDetail.price.toLocaleString()}đ</span>
              </div>
              {showSingleAddonDetail.description && <p className="text-xs text-gray-500">{showSingleAddonDetail.description}</p>}
              {(showSingleAddonDetail.images || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(showSingleAddonDetail.images || []).map((img, i) => (
                    <img key={i} src={img} alt={showSingleAddonDetail.name} className="w-full rounded-xl object-cover max-h-48" referrerPolicy="no-referrer" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                <div key={addon.id} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-start gap-3">
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
                  {(addon.images || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(addon.images || []).map((img, i) => (
                        <img key={i} src={img} alt={addon.name} className="w-full rounded-xl object-cover max-h-48" referrerPolicy="no-referrer" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Advanced Filter Modal */}
      {showAdvancedFilter && (
        <div
          className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAdvancedFilter(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-daiichi-red" />
                <h3 className="text-lg font-bold">{language === 'vi' ? 'Lọc nâng cao' : 'Advanced filter'}</h3>
                {advHasFilters && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-daiichi-red/10 text-daiichi-red">
                    {language === 'vi' ? 'Đang bật' : 'Active'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAdvancedFilter(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-6">
              {/* Time slots */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Clock size={14} className="text-daiichi-red" />
                  {language === 'vi' ? 'Lọc theo giờ khởi hành' : 'Filter by departure time'}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'morning',   label: language === 'vi' ? '🌅 Buổi sáng'  : '🌅 Morning',    desc: '05:00 – 11:59' },
                    { id: 'noon',      label: language === 'vi' ? '☀️ Buổi trưa'  : '☀️ Midday',     desc: '12:00 – 13:59' },
                    { id: 'afternoon', label: language === 'vi' ? '🌤 Buổi chiều' : '🌤 Afternoon',  desc: '14:00 – 17:59' },
                    { id: 'evening',   label: language === 'vi' ? '🌆 Buổi tối'   : '🌆 Evening',    desc: '18:00 – 21:59' },
                    { id: 'night',     label: language === 'vi' ? '🌙 Đêm khuya'  : '🌙 Late night', desc: '22:00 – 04:59' },
                  ].map(slot => (
                    <label
                      key={slot.id}
                      className={cn(
                        'flex flex-col gap-0.5 p-3 rounded-2xl border-2 cursor-pointer transition-all select-none',
                        advTimeSlots.has(slot.id)
                          ? 'border-daiichi-red bg-daiichi-red/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={advTimeSlots.has(slot.id)}
                        onChange={() => {
                          setAdvTimeSlots(prev => {
                            const next = new Set(prev);
                            if (next.has(slot.id)) next.delete(slot.id); else next.add(slot.id);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm font-bold">{slot.label}</span>
                      <span className="text-xs text-gray-400">{slot.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date quick select */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Calendar size={14} className="text-daiichi-red" />
                  {language === 'vi' ? 'Chọn ngày nhanh' : 'Quick date select'}
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'today',     label: language === 'vi' ? 'Hôm nay'          : 'Today' },
                    { id: 'tomorrow',  label: language === 'vi' ? 'Ngày mai'          : 'Tomorrow' },
                    { id: 'day_after', label: language === 'vi' ? 'Ngày kia'          : 'In 2 days' },
                    { id: 'minus1',    label: language === 'vi' ? 'Sớm hơn 1 ngày'   : '1 day earlier' },
                    { id: 'minus2',    label: language === 'vi' ? 'Sớm hơn 2 ngày'   : '2 days earlier' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => applyDateQuickOption(opt.id)}
                      className="py-2.5 px-2 rounded-xl text-xs font-bold border-2 border-gray-200 hover:border-daiichi-red hover:bg-daiichi-red/5 transition-all text-center"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3">
                  {language === 'vi' ? '↕️ Sắp xếp theo' : '↕️ Sort by'}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'default',      label: language === 'vi' ? '🔄 Mặc định'    : '🔄 Default' },
                    { id: 'price_asc',    label: language === 'vi' ? '💰 Rẻ nhất'     : '💰 Cheapest' },
                    { id: 'price_desc',   label: language === 'vi' ? '💎 Đắt nhất'    : '💎 Most expensive' },
                    { id: 'time_asc',     label: language === 'vi' ? '⏰ Sớm nhất'    : '⏰ Earliest' },
                    { id: 'time_desc',    label: language === 'vi' ? '🌙 Muộn nhất'   : '🌙 Latest' },
                    { id: 'duration_asc', label: language === 'vi' ? '⚡ Nhanh nhất'  : '⚡ Fastest' },
                  ] as { id: AdvSortBy; label: string }[]).map(opt => (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all select-none',
                        advSortBy === opt.id
                          ? 'border-daiichi-red bg-daiichi-red/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="advSortBy"
                        className="sr-only"
                        checked={advSortBy === opt.id}
                        onChange={() => setAdvSortBy(opt.id)}
                      />
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex-shrink-0',
                        advSortBy === opt.id ? 'border-daiichi-red bg-daiichi-red' : 'border-gray-300'
                      )} />
                      <span className="text-sm font-bold">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => { setAdvSortBy('default'); setAdvTimeSlots(new Set()); }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {language === 'vi' ? 'Đặt lại' : 'Reset'}
              </button>
              <button
                onClick={() => setShowAdvancedFilter(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-daiichi-red text-white hover:bg-daiichi-red/90 transition-colors"
              >
                {language === 'vi' ? 'Áp dụng' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
