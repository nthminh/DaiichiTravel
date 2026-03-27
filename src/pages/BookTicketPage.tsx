import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Bus, Users, Calendar, MapPin, Search, Clock, X, CheckCircle2, AlertTriangle, Phone, Gift, ChevronDown, ArrowUpDown, Heart, ChevronRight, Info } from 'lucide-react'
import { cn, getLocalDateString } from '../lib/utils'
import { Language, TRANSLATIONS, UserRole } from '../App'
import { SeatStatus, TripStatus, Trip, Route, Stop, TripAddon, Vehicle, RouteSurcharge } from '../types'
import { matchesSearch, matchScore } from '../lib/searchUtils'
import { parseDurationToMinutes } from '../lib/routeUtils'
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
  stops: Stop[];
  routes: Route[];
  vehicles: Vehicle[];
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
  onConfirm: (pickupStop: Stop | null, dropoffStop: Stop | null) => void;
  onClose: () => void;
}

function TripConfirmPanel({
  trip, route, stops, language, segmentFares,
  searchStationFrom, searchStationTo, searchFrom, searchTo,
  roundTripPhase, tripType, currentUser, searchAdults, searchChildren,
  onConfirm, onClose,
}: TripConfirmPanelProps) {
  const t = TRANSLATIONS[language];
  const isReturnPhase = tripType === 'ROUND_TRIP' && roundTripPhase === 'return';
  const effectiveFrom = isReturnPhase ? (searchStationTo || searchTo) : (searchStationFrom || searchFrom);
  const effectiveTo = isReturnPhase ? (searchStationFrom || searchFrom) : (searchStationTo || searchTo);

  const [selectedPickup, setSelectedPickup] = useState<Stop | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<Stop | null>(null);
  // ---- helpers ----
  const isAddressDisabledByDate = (disableFlag: boolean | undefined, fromDate: string | undefined, toDate: string | undefined, tripDate: string): boolean => {
    if (!disableFlag) return false;
    if (!fromDate && !toDate) return true;
    const afterFrom = fromDate ? tripDate >= fromDate : true;
    const beforeTo = toDate ? tripDate <= toDate : true;
    return !!tripDate && afterFrom && beforeTo;
  };

  const parseTimeToMinutes = (timeValue?: string): number | null => {
    if (!timeValue) return null;
    const [hours, minutes] = timeValue.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return (hours * 60) + minutes;
  };

  const isTripTimeWithinRange = (tripTimeValue: string | undefined, fromTime: string | undefined, toTime: string | undefined): boolean => {
    if (!fromTime && !toTime) return true;
    const tripMinutes = parseTimeToMinutes(tripTimeValue);
    if (tripMinutes === null) return false;
    const fromMinutes = parseTimeToMinutes(fromTime);
    const toMinutes = parseTimeToMinutes(toTime);
    if (fromMinutes !== null && toMinutes !== null) {
      return fromMinutes <= toMinutes
        ? tripMinutes >= fromMinutes && tripMinutes <= toMinutes
        : tripMinutes >= fromMinutes || tripMinutes <= toMinutes;
    }
    if (fromMinutes !== null) return tripMinutes >= fromMinutes;
    if (toMinutes !== null) return tripMinutes <= toMinutes;
    return true;
  };

  const getApplicableRouteSurcharges = (r: Route | undefined, tripDate: string): RouteSurcharge[] => {
    if (!r?.surcharges) return [];
    return r.surcharges.filter(sc => {
      if (!sc.isActive) return false;
      if (sc.startDate && sc.endDate) return !!tripDate && tripDate >= sc.startDate && tripDate <= sc.endDate;
      return true;
    });
  };

  const resolveTerminal = (selectedName: string | undefined, routeDefaultName: string | undefined): Stop | undefined => {
    const name = selectedName || routeDefaultName;
    if (!name) return undefined;
    const direct = stops.find(s => s.type === 'TERMINAL' && s.name === name);
    if (direct) return direct;
    const parentId = stops.find(s => s.name === name)?.terminalId;
    if (parentId) return stops.find(s => s.id === parentId);
    return undefined;
  };

  const tripDate = trip.date || '';
  const applicableSurcharges = getApplicableRouteSurcharges(route, tripDate);

  // ---- Pickup stops ----
  const departureTerminal = resolveTerminal(effectiveFrom, route?.departurePoint);
  const isPickupDisabledByDate = isAddressDisabledByDate(route?.disablePickupAddress, route?.disablePickupAddressFrom, route?.disablePickupAddressTo, tripDate);
  const pickupDisableStopType = route?.disablePickupAddressStopType || 'ALL';
  const pickupSectionDisabled = isPickupDisabledByDate && pickupDisableStopType === 'ALL';
  const disabledPickupCategories = route?.disabledPickupCategories ?? [];
  const isPickupCategoryDisableActive = disabledPickupCategories.length > 0 && isTripTimeWithinRange(trip.time, route?.disabledPickupCategoriesFromTime, route?.disabledPickupCategoriesToTime);

  const pickupStops = useMemo(() => {
    const base = departureTerminal
      ? stops.filter(s => s.terminalId === departureTerminal.id)
      : stops.filter(s => s.type !== 'TERMINAL');
    const afterType = isPickupDisabledByDate && pickupDisableStopType !== 'ALL'
      ? base.filter(s => (s.type ?? 'STOP') !== pickupDisableStopType)
      : base;
    return isPickupCategoryDisableActive
      ? afterType.filter(s => !disabledPickupCategories.includes(s.category ?? ''))
      : afterType;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, departureTerminal?.id, isPickupDisabledByDate, pickupDisableStopType, route?.disabledPickupCategories, route?.disabledPickupCategoriesFromTime, route?.disabledPickupCategoriesToTime, trip.time]);

  // ---- Dropoff stops ----
  const arrivalTerminal = resolveTerminal(effectiveTo, route?.arrivalPoint);
  const isDropoffDisabledByDate = isAddressDisabledByDate(route?.disableDropoffAddress, route?.disableDropoffAddressFrom, route?.disableDropoffAddressTo, tripDate);
  const dropoffDisableStopType = route?.disableDropoffAddressStopType || 'ALL';
  const dropoffSectionDisabled = isDropoffDisabledByDate && dropoffDisableStopType === 'ALL';
  const disabledDropoffCategories = route?.disabledDropoffCategories ?? [];
  const isDropoffCategoryDisableActive = disabledDropoffCategories.length > 0 && isTripTimeWithinRange(trip.time, route?.disabledDropoffCategoriesFromTime, route?.disabledDropoffCategoriesToTime);

  const dropoffStops = useMemo(() => {
    const base = arrivalTerminal
      ? stops.filter(s => s.terminalId === arrivalTerminal.id)
      : stops.filter(s => s.type !== 'TERMINAL');
    const afterType = isDropoffDisabledByDate && dropoffDisableStopType !== 'ALL'
      ? base.filter(s => (s.type ?? 'STOP') !== dropoffDisableStopType)
      : base;
    return isDropoffCategoryDisableActive
      ? afterType.filter(s => !disabledDropoffCategories.includes(s.category ?? ''))
      : afterType;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, arrivalTerminal?.id, isDropoffDisabledByDate, dropoffDisableStopType, route?.disabledDropoffCategories, route?.disabledDropoffCategoriesFromTime, route?.disabledDropoffCategoriesToTime, trip.time]);

  // ---- Time calculation ----
  const calcTime = (base: string, offsetMins: number): string => {
    const [h, m] = base.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return base;
    const total = h * 60 + m + offsetMins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
    const stops_list: { name: string; time: string | null; isEndpoint: boolean }[] = [];
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
    const matchedStop = preferredName
      ? orderedItinerary.find(stop =>
          stop.name === preferredName || matchesSearch(stop.name, preferredName) || matchesSearch(preferredName, stop.name),
        )
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
  const pickupSurchargeAmt = selectedPickup?.surcharge || 0;
  const dropoffSurchargeAmt = selectedDropoff?.surcharge || 0;
  const routeSurchargeTotal = applicableSurcharges.reduce((sum, sc) => sum + sc.amount, 0);
  const totalPerPerson = discountedFare + pickupSurchargeAmt + dropoffSurchargeAmt + routeSurchargeTotal;

  const stepLabels: [string, string, string, string] = [
    t.step_select_trip || 'Chọn chuyến',
    t.step_pickup_dropoff || 'Điểm đón/trả',
    t.step_select_seat || 'Chọn ghế',
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
            <StepIndicator currentStep={2} labels={stepLabels} />
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
                <span className="px-2.5 py-1 bg-red-50 text-daiichi-red rounded-full text-xs font-bold flex-shrink-0">{trip.date}</span>
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
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.trip_confirm_route_title || 'Hành trình xe sẽ đi qua'}</h3>
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
                            )}>{stop.time}</span>
                          )}
                          <span className={cn(
                            "text-xs truncate",
                            stop.isEndpoint ? "font-semibold text-gray-800" : "font-medium text-gray-600"
                          )}>{stop.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Pickup selection ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-daiichi-red flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.trip_confirm_pickup_title || 'Chọn điểm đón'}</h3>
              <span className="text-[10px] text-gray-400 ml-auto">{t.trip_confirm_optional || '(Không bắt buộc)'}</span>
            </div>
            <div className="p-3">
              {pickupSectionDisabled ? (
                <div className="flex items-center gap-2 py-2 text-xs text-amber-600">
                  <Info size={13} className="flex-shrink-0" />
                  <span>{t.trip_confirm_pickup_disabled || 'Điểm đón bị tắt cho tuyến/ngày này'}</span>
                </div>
              ) : pickupStops.length === 0 ? (
                <p className="text-xs text-gray-400 py-2 italic">{t.trip_confirm_no_pickup_stops || 'Không có điểm đón tại bến này'}</p>
              ) : (
                <CompactStopSelector
                  stops={pickupStops}
                  selectedStop={selectedPickup}
                  onSelect={setSelectedPickup}
                  placeholder={language === 'vi' ? 'Gõ để tìm điểm đón...' : language === 'ja' ? '乗車地を検索...' : 'Search pickup point...'}
                  emptyLabel={t.not_selected_yet || 'Chưa chọn'}
                  theme="pickup"
                />
              )}
            </div>
          </div>

          {/* ── Dropoff selection ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t.trip_confirm_dropoff_title || 'Chọn điểm trả'}</h3>
              <span className="text-[10px] text-gray-400 ml-auto">{t.trip_confirm_optional || '(Không bắt buộc)'}</span>
            </div>
            <div className="p-3">
              {dropoffSectionDisabled ? (
                <div className="flex items-center gap-2 py-2 text-xs text-amber-600">
                  <Info size={13} className="flex-shrink-0" />
                  <span>{t.trip_confirm_dropoff_disabled || 'Điểm trả bị tắt cho tuyến/ngày này'}</span>
                </div>
              ) : dropoffStops.length === 0 ? (
                <p className="text-xs text-gray-400 py-2 italic">{t.trip_confirm_no_dropoff_stops || 'Không có điểm trả tại bến này'}</p>
              ) : (
                <CompactStopSelector
                  stops={dropoffStops}
                  selectedStop={selectedDropoff}
                  onSelect={setSelectedDropoff}
                  placeholder={language === 'vi' ? 'Gõ để tìm điểm trả...' : language === 'ja' ? '降車地を検索...' : 'Search dropoff point...'}
                  emptyLabel={t.not_selected_yet || 'Chưa chọn'}
                  theme="dropoff"
                />
              )}
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
              {pickupSurchargeAmt > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t.trip_confirm_pickup_surcharge || 'Phụ phí điểm đón'} ({selectedPickup?.name})</span>
                  <span className="font-semibold text-orange-600">+{pickupSurchargeAmt.toLocaleString()}đ</span>
                </div>
              )}
              {dropoffSurchargeAmt > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t.trip_confirm_dropoff_surcharge || 'Phụ phí điểm trả'} ({selectedDropoff?.name})</span>
                  <span className="font-semibold text-orange-600">+{dropoffSurchargeAmt.toLocaleString()}đ</span>
                </div>
              )}
              {applicableSurcharges.map(sc => (
                <div key={sc.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t.trip_confirm_surcharges || 'Phụ phí tuyến'}: {sc.name}</span>
                  <span className="font-semibold text-orange-600">+{sc.amount.toLocaleString()}đ</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm font-bold text-gray-800">{t.trip_confirm_total || 'Tổng dự kiến / người'}</span>
                <span className="text-base font-bold text-daiichi-red">{totalPerPerson.toLocaleString()}đ</span>
              </div>
              {(searchAdults > 1 || searchChildren > 0) && (
                <p className="text-[10px] text-gray-400">
                  × {searchAdults + searchChildren} {language === 'vi' ? 'hành khách' : language === 'ja' ? '名' : 'passengers'}
                  {' ≈ '}<span className="font-semibold text-gray-600">{(totalPerPerson * (searchAdults + searchChildren)).toLocaleString()}đ</span>
                </p>
              )}
            </div>
          </div>

          {/* Tip note */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
            <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">{t.trip_confirm_note || 'Vui lòng xác nhận thông tin trước khi chọn ghế'}</p>
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
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
            onClick={() => onConfirm(selectedPickup, selectedDropoff)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all"
          >
            <CheckCircle2 size={16} />
            <span>{t.confirm_and_select_seat || 'Xác nhận & Chọn ghế'}</span>
            <ChevronRight size={16} />
          </button>
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
  // Favorites
  likedTrips: Set<string>;
  toggleLikedTrip: (tripId: string) => void;
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
  likedTrips,
  toggleLikedTrip,
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

  // Local filter state: combined vehicle type + seat count (e.g. "Limousine 11 ghế")
  const [localVehicleCombo, setLocalVehicleCombo] = useState('');

  // Compute unique vehicle type+seat combinations from active trips for the combined filter
  const availableCombinations = useMemo(() => {
    const activePlates = new Set(
      trips
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
  }, [trips, vehicles]);

  // Parse the combo value into type/seats for filter comparisons
  const comboType = localVehicleCombo ? localVehicleCombo.split('::')[0] : '';
  const comboSeats = localVehicleCombo ? parseInt(localVehicleCombo.split('::')[1]) || 0 : 0;

  // Committed search parameters: set when the user clicks the Search button.
  // filterTrip() and segmentFares use these values so that the list only updates
  // when the button is explicitly clicked, not on every keystroke.
  const [committedParams, setCommittedParams] = useState<CommittedSearchParams | null>(null);

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
  }, [committedParams, tripType, roundTripPhase, routes, stops, trips]);

  // Show the search result notification after segment fares have finished loading for the current
  // search. We track the false→true transition of segmentFaresLoaded so we don't accidentally fire
  // on a stale `true` value that was left over from a previous search.
  useEffect(() => {
    const wasLoaded = prevSegmentFaresLoadedRef.current;
    prevSegmentFaresLoadedRef.current = segmentFaresLoaded;

    if (!wasLoaded && segmentFaresLoaded && pendingNotificationRef.current) {
      pendingNotificationRef.current = false;
      const vehicleMap = new Map(vehicles.map(v => [v.licensePlate, v]));
      const count = trips.filter(trip => {
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
  }, [segmentFaresLoaded, trips]);

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
      ].join(' ');
      if (!matchesSearch(searchable, p.freeSearch)) return false;
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
      const count = trips.filter(trip => {
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
              // RUNNING trips: visible to customers but direct booking is not available.
              // Customers must contact an agency to book.
              if (isRunning) {
                return (
                  <button
                    onClick={() => showToast(t.running_trip_contact_msg || 'Chuyến này đang chạy. Vui lòng liên hệ đại lý để đặt vé.', 'info')}
                    className="w-full px-2 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 cursor-pointer"
                  >
                    🚌 {t.contact_agency_to_book || 'Liên hệ đại lý để đặt'}
                  </button>
                );
              }
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
                  onClick={() => setPendingConfirmTrip(trip)}
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
              <div className="flex items-stretch gap-2 min-w-0">
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
            </div>
          );
        })()}
      </div>
    );
  };

  // Handler called when user confirms in TripConfirmPanel
  const handleTripConfirm = (pickupStop: Stop | null, dropoffStop: Stop | null) => {
    if (!pendingConfirmTrip) return;
    // Set pickup/dropoff from the user's selection in the confirm panel
    setPickupAddress(pickupStop ? pickupStop.name : '');
    setPickupStopAddress(pickupStop ? (pickupStop.address || '') : '');
    setPickupAddressSurcharge(pickupStop ? (pickupStop.surcharge || 0) : 0);
    setDropoffAddress(dropoffStop ? dropoffStop.name : '');
    setDropoffStopAddress(dropoffStop ? (dropoffStop.address || '') : '');
    setDropoffAddressSurcharge(dropoffStop ? (dropoffStop.surcharge || 0) : 0);
    // Navigate to seat mapping
    setSelectedTrip(pendingConfirmTrip);
    setPreviousTab('book-ticket');
    setActiveTab('seat-mapping');
    setPendingConfirmTrip(null);
  };

  return (
    <>
    {/* TripConfirmPanel – full-screen overlay shown when user clicks a trip card */}
    {pendingConfirmTrip && (
      <TripConfirmPanel
        trip={pendingConfirmTrip}
        route={routes.find(r => r.name === pendingConfirmTrip.route)}
        stops={stops}
        routes={routes}
        vehicles={vehicles}
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
        onConfirm={handleTripConfirm}
        onClose={() => setPendingConfirmTrip(null)}
      />
    )}
    <div className="space-y-8">
      <div className="bg-white p-2 sm:p-8 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-6">
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
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-4", tripType === 'ROUND_TRIP' ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {/* FROM + TO combined cell with swap button overlaid between inputs */}
          <div className="lg:col-span-2">
            {/* FROM and TO – on mobile: two separate bordered pair cards; on sm+: side by side */}
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
          <div className="sm:shrink-0 sm:ml-auto sm:flex sm:mt-4">
            <button
              onClick={handleSearch}
              className="w-full sm:w-auto px-4 sm:px-8 py-3 sm:py-4 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap bg-daiichi-red shadow-daiichi-red/20 hover:scale-[1.02]"
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
          const likedSuggestions = trips.filter(tr => likedTrips.has(tr.id) && eligibleStatuses.includes(tr.status));
          const discountedSuggestions = trips.filter(tr =>
            !likedTrips.has(tr.id) &&
            (tr.discountPercent || 0) > 0 &&
            eligibleStatuses.includes(tr.status)
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
            return trips.filter(tr => {
              if (!filterTrip(tr, true)) return false;
              if (localVehicleCombo) {
                const v = vehicleMap.get(tr.licensePlate);
                if (comboType && v?.type !== comboType) return false;
                if (comboSeats > 0 && v?.seats !== comboSeats) return false;
              }
              return true;
            }).sort((a, b) => compareTripDateTime(a, b));
          })();

          // Nearest trips: same route/direction but without date restriction, sorted by date proximity
          const nearestTrips = filteredBookingTrips.length === 0 && (effectiveFrom || effectiveTo)
            ? trips
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
    </>
  );
}
