import React, { useState, useCallback } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SeatCell {
  /** Unique label shown in the cell, e.g. "1", "A1", "B2" */
  label: string;
  /** true = aisle / empty space */
  isAisle?: boolean;
  /** true = this is the driver seat (not bookable) */
  isDriver?: boolean;
  /** true = this seat is discounted due to an unfavourable position */
  discounted?: boolean;
  /** booked status (read-only, not editable in the diagram builder) */
  booked?: boolean;
  /** true = sleeper/lying berth; false/undefined = sitting seat */
  isSleeper?: boolean;
}

export type DeckLayout = SeatCell[][];

export interface VehicleLayout {
  decks: DeckLayout[];
}

// ─── Layout generators ──────────────────────────────────────────────────────

/**
 * Build a bus row cell array. Pass null for aisle gaps.
 */
function busRow(labels: (string | null)[]): SeatCell[] {
  return labels.map(l =>
    l === null ? { label: '', isAisle: true } : { label: l }
  );
}

/**
 * Standard 4-across bus layout (2 left + aisle + 2 right).
 * Row 0: Driver seat + seat 1 on the right.
 * Remaining rows: L1 L2 | aisle | R1 R2.
 */
function busLayout(seatCount: number): DeckLayout {
  const rows: SeatCell[][] = [];
  // Row 0: driver + 3 cols gap/seat
  rows.push([
    { label: '', isDriver: true },
    { label: '', isAisle: true },
    { label: '', isAisle: true },
    { label: '1' },
  ]);
  let n = 2;
  while (n <= seatCount) {
    const l1 = n <= seatCount ? String(n++) : null;
    const l2 = n <= seatCount ? String(n++) : null;
    const r1 = n <= seatCount ? String(n++) : null;
    const r2 = n <= seatCount ? String(n++) : null;
    rows.push([
      l1 ? { label: l1 } : { label: '', isAisle: true },
      l2 ? { label: l2 } : { label: '', isAisle: true },
      { label: '', isAisle: true },
      r1 ? { label: r1 } : { label: '', isAisle: true },
      r2 ? { label: r2 } : { label: '', isAisle: true },
    ]);
  }
  return rows;
}

/** 2-column minivan layout for 6 seats */
function minivanLayout(seatCount: number): DeckLayout {
  // Row 0: driver | _ | seat 1
  // Following rows: seat A | seat B | _
  const rows: SeatCell[][] = [];
  rows.push([{ label: '', isDriver: true }, { label: '', isAisle: true }, { label: '1' }]);
  let n = 2;
  while (n <= seatCount) {
    const a = String(n++);
    const b = n <= seatCount ? String(n++) : null;
    rows.push([{ label: a }, b ? { label: b } : { label: '', isAisle: true }, { label: '', isAisle: true }]);
  }
  return rows;
}

/** 10-seat van: 1+2 layout (1 on left, 2 on right, with aisle) */
function van10Layout(seatCount: number): DeckLayout {
  const rows: SeatCell[][] = [];
  rows.push([{ label: '', isDriver: true }, { label: '', isAisle: true }, { label: '1' }, { label: '2' }]);
  let n = 3;
  while (n <= seatCount) {
    const l = String(n++);
    const r1 = n <= seatCount ? String(n++) : null;
    const r2 = n <= seatCount ? String(n++) : null;
    rows.push([
      { label: l },
      { label: '', isAisle: true },
      r1 ? { label: r1 } : { label: '', isAisle: true },
      r2 ? { label: r2 } : { label: '', isAisle: true },
    ]);
  }
  return rows;
}

/** 16-seat limousine: 1+1 layout (1 on each side with wide aisle in between) */
function limousineLayout(seatCount: number): DeckLayout {
  const rows: SeatCell[][] = [
    [{ label: '', isDriver: true }, { label: '', isAisle: true }, { label: '', isAisle: true }, { label: '', isAisle: true }],
  ];
  let n = 1;
  while (n <= seatCount) {
    const l = String(n++);
    const r = n <= seatCount ? String(n++) : null;
    rows.push([
      { label: l },
      { label: '', isAisle: true },
      { label: '', isAisle: true },
      r ? { label: r } : { label: '', isAisle: true },
    ]);
  }
  return rows;
}

/** Sleeper bus – double deck with 3-across bunk berths */
function sleeperLayout(seatCount: number): { lower: DeckLayout; upper: DeckLayout } {
  const perDeck = Math.ceil(seatCount / 2);
  const buildDeck = (start: number, count: number): DeckLayout => {
    const rows: SeatCell[][] = [];
    let n = start;
    const end = start + count - 1;
    while (n <= end) {
      const l = n <= end ? String(n++) : null;
      const m = n <= end ? String(n++) : null;
      const r = n <= end ? String(n++) : null;
      rows.push([
        l ? { label: l } : { label: '', isAisle: true },
        { label: '', isAisle: true },
        m ? { label: m } : { label: '', isAisle: true },
        { label: '', isAisle: true },
        r ? { label: r } : { label: '', isAisle: true },
      ]);
    }
    return rows;
  };
  return {
    lower: buildDeck(1, perDeck),
    upper: buildDeck(perDeck + 1, seatCount - perDeck),
  };
}

/** Cabin / VIP room layout: 2 cabins per row */
function cabinLayout(seatCount: number): DeckLayout {
  const rows: SeatCell[][] = [];
  for (let i = 0; i < Math.ceil(seatCount / 2); i++) {
    const l = i * 2 + 1;
    const r = i * 2 + 2;
    rows.push([
      { label: `Cabin\n${l}` },
      { label: '', isAisle: true },
      r <= seatCount ? { label: `Cabin\n${r}` } : { label: '', isAisle: true },
    ]);
  }
  return rows;
}

export function generateVehicleLayout(type: string, seatCount: number): VehicleLayout {
  const typeLower = type.toLowerCase();

  // Sleeper bus (giường nằm)
  if (typeLower.includes('giường') || typeLower.includes('sleeper')) {
    const { lower, upper } = sleeperLayout(seatCount);
    return { decks: [lower, upper] };
  }

  // VIP Cabin
  if (typeLower.includes('cabin') || typeLower.includes('vip')) {
    return { decks: [cabinLayout(seatCount)] };
  }

  // Limousine
  if (typeLower.includes('limousine') || typeLower.includes('limo') || typeLower.includes('luxury')) {
    return { decks: [limousineLayout(seatCount)] };
  }

  // Small minivan 6–7 seats
  if (seatCount <= 7) return { decks: [minivanLayout(seatCount)] };

  // 10-seat van
  if (seatCount <= 11) return { decks: [van10Layout(seatCount)] };

  // Standard bus 12+
  return { decks: [busLayout(seatCount)] };
}

// ─── Persistence helpers ────────────────────────────────────────────────────

/** Serialise a VehicleLayout to a flat list for Firestore storage */
export function serializeLayout(layout: VehicleLayout): SerializedSeat[] {
  const result: SerializedSeat[] = [];
  layout.decks.forEach((deck, deckIdx) => {
    deck.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        if (!cell.isAisle && !cell.isDriver) {
          result.push({
            id: `${deckIdx}-${rowIdx}-${colIdx}`,
            label: cell.label,
            row: rowIdx,
            col: colIdx,
            deck: deckIdx,
            discounted: cell.discounted ?? false,
            booked: cell.booked ?? false,
            isSleeper: cell.isSleeper ?? false,
          });
        }
      });
    });
  });
  return result;
}

export interface SerializedSeat {
  id: string;
  label: string;
  row: number;
  col: number;
  deck: number;
  discounted: boolean;
  booked: boolean;
  isSleeper?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  licensePlate: string;
  vehicleType: string;
  seatCount: number;
  /** Persisted layout (if any). Pass null to use generated default. */
  savedSeats?: SerializedSeat[] | null;
  /** Whether the manager can edit the layout */
  editable?: boolean;
  onSave?: (seats: SerializedSeat[]) => void;
  onClose: () => void;
  language?: 'vi' | 'en' | 'ja';
}

export const VehicleSeatDiagram: React.FC<Props> = ({
  licensePlate,
  vehicleType,
  seatCount,
  savedSeats,
  editable = false,
  onSave,
  onClose,
  language = 'vi',
}) => {
  // Build working layout from saved seats or generate default
  const buildLayout = useCallback((): VehicleLayout => {
    if (savedSeats && savedSeats.length > 0) {
      // Reconstruct from flat list
      const deckCount = Math.max(...savedSeats.map(s => s.deck)) + 1;
      const rowCount = Math.max(...savedSeats.map(s => s.row)) + 1;
      const colCount = Math.max(...savedSeats.map(s => s.col)) + 1;
      const decks: DeckLayout[] = Array.from({ length: deckCount }, () =>
        Array.from({ length: rowCount }, () =>
          Array.from({ length: colCount }, (): SeatCell => ({ label: '', isAisle: true }))
        )
      );
      savedSeats.forEach(s => {
        decks[s.deck][s.row][s.col] = {
          label: s.label,
          discounted: s.discounted,
          booked: s.booked,
          isSleeper: s.isSleeper,
        };
      });
      return { decks };
    }
    return generateVehicleLayout(vehicleType, seatCount);
  }, [savedSeats, vehicleType, seatCount]);

  const [layout, setLayout] = useState<VehicleLayout>(buildLayout);
  const [activeDeck, setActiveDeck] = useState(0);
  const [editMode, setEditMode] = useState<'view' | 'discount' | 'position' | 'type'>('view');
  const [isDirty, setIsDirty] = useState(() => !savedSeats || savedSeats.length === 0);
  const [showLabels, setShowLabels] = useState(true);

  const isMultiDeck = layout.decks.length > 1;

  const toggleDiscount = (deckIdx: number, rowIdx: number, colIdx: number) => {
    if (!editable || editMode !== 'discount') return;
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      const cell = next.decks[deckIdx][rowIdx][colIdx];
      if (!cell.isAisle && !cell.isDriver) {
        cell.discounted = !cell.discounted;
      }
      return next;
    });
    setIsDirty(true);
  };

  const togglePosition = (deckIdx: number, rowIdx: number, colIdx: number) => {
    if (!editable || editMode !== 'position') return;
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      const cell = next.decks[deckIdx][rowIdx][colIdx];
      if (cell.isDriver) return prev; // never toggle driver cell
      if (cell.isAisle) {
        // Aisle → seat: auto-assign the next available label
        const allLabels = next.decks.flatMap(d => d.flatMap(r => r))
          .filter(c => !c.isAisle && !c.isDriver)
          .map(c => Number(c.label))
          .filter(n => !isNaN(n));
        const maxLabel = allLabels.length > 0 ? Math.max(...allLabels) : 0;
        cell.label = String(maxLabel + 1);
        delete cell.isAisle;
      } else {
        // Seat → aisle
        cell.label = '';
        cell.isAisle = true;
        delete cell.discounted;
        delete cell.booked;
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleCellClick = (deckIdx: number, rowIdx: number, colIdx: number) => {
    if (editMode === 'discount') toggleDiscount(deckIdx, rowIdx, colIdx);
    else if (editMode === 'position') togglePosition(deckIdx, rowIdx, colIdx);
    else if (editMode === 'type') toggleSeatType(deckIdx, rowIdx, colIdx);
  };

  const toggleSeatType = (deckIdx: number, rowIdx: number, colIdx: number) => {
    if (!editable || editMode !== 'type') return;
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      const cell = next.decks[deckIdx][rowIdx][colIdx];
      if (!cell.isAisle && !cell.isDriver) {
        cell.isSleeper = !cell.isSleeper;
      }
      return next;
    });
    setIsDirty(true);
  };

  const toggleAllSeats = () => {
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      const hasAnySeats = next.decks.some(d => d.some(r => r.some(c => !c.isAisle && !c.isDriver)));
      let seatCounter = 1;
      next.decks.forEach(deck => {
        deck.forEach(row => {
          row.forEach(cell => {
            if (cell.isDriver) return;
            if (hasAnySeats) {
              // Turn all seats into aisles
              cell.label = '';
              cell.isAisle = true;
              delete cell.discounted;
              delete cell.booked;
            } else {
              // Turn all aisles into seats
              cell.label = String(seatCounter++);
              delete cell.isAisle;
            }
          });
        });
      });
      return next;
    });
    setIsDirty(true);
  };

  const handleReset = () => {
    setLayout(generateVehicleLayout(vehicleType, seatCount));
    setIsDirty(true);
  };

  // ─── Grid size / deck controls ─────────────────────────────────────────────

  const addRow = () => {
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      const colCount = next.decks[activeDeck]?.[0]?.length ?? 4;
      const newRow: SeatCell[] = Array.from({ length: colCount }, () => ({ label: '', isAisle: true, isSleeper: false }));
      next.decks[activeDeck].push(newRow);
      return next;
    });
    setIsDirty(true);
  };

  const removeRow = () => {
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      if (next.decks[activeDeck].length > 1) next.decks[activeDeck].pop();
      return next;
    });
    setIsDirty(true);
  };

  const addCol = () => {
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      next.decks.forEach(deck => {
        deck.forEach(row => row.push({ label: '', isAisle: true, isSleeper: false }));
      });
      return next;
    });
    setIsDirty(true);
  };

  const removeCol = () => {
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      next.decks.forEach(deck => {
        deck.forEach(row => { if (row.length > 1) row.pop(); });
      });
      return next;
    });
    setIsDirty(true);
  };

  const addDeck = () => {
    setLayout(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      const refDeck = next.decks[0];
      const newDeck: DeckLayout = refDeck.map(row =>
        row.map(cell => cell.isDriver ? { ...cell } : { label: '', isAisle: true })
      );
      next.decks.push(newDeck);
      return next;
    });
    setIsDirty(true);
  };

  const removeDeck = () => {
    setLayout(prev => {
      if (prev.decks.length <= 1) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as VehicleLayout;
      next.decks.pop();
      return next;
    });
    setActiveDeck(d => Math.max(0, d - 1));
    setIsDirty(true);
  };

  const handleSave = () => {
    const seats = serializeLayout(layout);
    onSave?.(seats);
    setIsDirty(false);
  };

  const currentDeck = layout.decks[activeDeck] ?? [];

  // Passenger seat = not aisle, not driver
  const allPassengerSeats = layout.decks.flatMap(d => d.flatMap(r => r)).filter(c => !c.isAisle && !c.isDriver);
  const totalSeats = allPassengerSeats.length;
  const bookedSeats = allPassengerSeats.filter(c => c.booked).length;
  const discountedSeats = allPassengerSeats.filter(c => c.discounted).length;
  // Available = not booked (discounted but unbooked seats are still available)
  const availableSeats = totalSeats - bookedSeats;

  const t = {
    vi: {
      title: 'Sơ đồ chỗ ngồi',
      lower: 'Tầng dưới',
      upper: 'Tầng trên',
      available: 'Trống',
      booked: 'Đã đặt',
      discounted: 'Giảm giá (vị trí kém)',
      sleeper: 'Giường nằm',
      editDiscount: 'Đánh dấu ghế giảm giá',
      editPosition: 'Chỉnh sửa vị trí ghế',
      editType: 'Đổi loại ghế (ngồi/nằm)',
      tipType: 'Nhấp vào ghế để chuyển đổi ngồi ↔ nằm',
      view: 'Chế độ xem',
      reset: 'Khôi phục mặc định',
      save: 'Lưu sơ đồ',
      close: 'Đóng',
      seats_total: 'Tổng chỗ',
      seats_available: 'Còn trống',
      seats_booked: 'Đã đặt',
      seats_discounted: 'Giảm giá',
      tip: 'Nhấp vào ghế để đánh dấu/bỏ đánh dấu giảm giá',
      tipPosition: 'Nhấp vào ô trống để thêm ghế, nhấp vào ghế để xóa',
      front: '← Đầu xe (Tài xế bên trái)',
      toggleAllOn: 'Bật tất cả ghế',
      toggleAllOff: 'Tắt tất cả ghế',
      hideLabels: 'Ẩn số thứ tự',
      showLabels: 'Hiện số thứ tự',
      addRow: '+ Hàng',
      removeRow: '− Hàng',
      addCol: '+ Cột',
      removeCol: '− Cột',
      addDeck: '+ Tầng',
      removeDeck: '− Tầng',
      deck: 'Tầng',
      grid: 'Lưới',
    },
    en: {
      title: 'Seat Diagram',
      lower: 'Lower Deck',
      upper: 'Upper Deck',
      available: 'Available',
      booked: 'Booked',
      discounted: 'Discounted (bad position)',
      sleeper: 'Sleeper berth',
      editDiscount: 'Mark Discounted Seats',
      editPosition: 'Edit Seat Positions',
      editType: 'Toggle Seat Type (sit/sleep)',
      tipType: 'Click a seat to toggle sitting ↔ sleeper',
      view: 'View Mode',
      reset: 'Reset Layout',
      save: 'Save Layout',
      close: 'Close',
      seats_total: 'Total Seats',
      seats_available: 'Available',
      seats_booked: 'Booked',
      seats_discounted: 'Discounted',
      tip: 'Click seats to toggle discount mark',
      tipPosition: 'Click empty cell to add seat, click seat to remove',
      front: '← Front (Driver on left)',
      toggleAllOn: 'Enable All Seats',
      toggleAllOff: 'Disable All Seats',
      hideLabels: 'Hide Numbers',
      showLabels: 'Show Numbers',
      addRow: '+ Row',
      removeRow: '− Row',
      addCol: '+ Col',
      removeCol: '− Col',
      addDeck: '+ Deck',
      removeDeck: '− Deck',
      deck: 'Deck',
      grid: 'Grid',
    },
    ja: {
      title: '座席図',
      lower: '下段',
      upper: '上段',
      available: '空席',
      booked: '予約済',
      discounted: '割引（不利な位置）',
      sleeper: '寝台',
      editDiscount: '割引席をマーク',
      editPosition: '座席位置を編集',
      editType: '座席タイプを変更（座席/寝台）',
      tipType: '座席をクリックして座席 ↔ 寝台を切り替え',
      view: '表示モード',
      reset: 'デフォルトに戻す',
      save: '保存',
      close: '閉じる',
      seats_total: '総座席数',
      seats_available: '空席',
      seats_booked: '予約済',
      seats_discounted: '割引',
      tip: '座席をクリックして割引マークを切り替え',
      tipPosition: '空セルをクリックして座席を追加、座席をクリックして削除',
      front: '← 前方（運転手は左側）',
      toggleAllOn: '全座席を有効化',
      toggleAllOff: '全座席を無効化',
      hideLabels: '番号を非表示',
      showLabels: '番号を表示',
      addRow: '+ 行',
      removeRow: '− 行',
      addCol: '+ 列',
      removeCol: '− 列',
      addDeck: '+ フロア',
      removeDeck: '− フロア',
      deck: 'フロア',
      grid: 'グリッド',
    },
  };
  const label = t[language] ?? t.vi;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-[28px] w-full max-w-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{label.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {licensePlate} · {vehicleType} · {seatCount} chỗ
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 px-7 py-4 bg-gray-50">
          {[
            { label: label.seats_total, value: totalSeats, color: 'text-gray-700' },
            { label: label.seats_available, value: availableSeats, color: 'text-green-600' },
            { label: label.seats_booked, value: bookedSeats, color: 'text-red-600' },
            { label: label.seats_discounted, value: discountedSeats, color: 'text-amber-600' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Deck tabs (for sleeper buses) */}
        {isMultiDeck && (
          <div className="flex gap-2 px-7 pt-4">
            {layout.decks.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveDeck(i)}
                className={cn(
                  'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                  activeDeck === i
                    ? 'bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                {i === 0 ? label.lower : label.upper}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        {editable && (
          <div className="flex flex-wrap items-center gap-2 px-7 pt-4">
            {/* Edit-mode buttons */}
            <button
              onClick={() => setEditMode(editMode === 'discount' ? 'view' : 'discount')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                editMode === 'discount'
                  ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
              {editMode === 'discount' ? label.tip : label.editDiscount}
            </button>
            <button
              onClick={() => setEditMode(editMode === 'position' ? 'view' : 'position')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                editMode === 'position'
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />
              {editMode === 'position' ? label.tipPosition : label.editPosition}
            </button>
            <button
              onClick={() => setEditMode(editMode === 'type' ? 'view' : 'type')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                editMode === 'type'
                  ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <span className="w-3 h-3 rounded-sm bg-indigo-400 inline-block" />
              {editMode === 'type' ? label.tipType : label.editType}
            </button>
            {/* Toggle seat number labels */}
            <button
              onClick={() => setShowLabels(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            >
              {showLabels ? label.hideLabels : label.showLabels}
            </button>
            {/* Toggle all seats on/off */}
            <button
              onClick={toggleAllSeats}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                totalSeats > 0
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              )}
            >
              <span className={cn('w-3 h-3 rounded-sm inline-block', totalSeats > 0 ? 'bg-red-400' : 'bg-green-400')} />
              {totalSeats > 0 ? label.toggleAllOff : label.toggleAllOn}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            >
              <RotateCcw size={12} /> {label.reset}
            </button>
          </div>
        )}

        {/* Grid size + deck controls */}
        {editable && (
          <div className="flex flex-wrap items-center gap-2 px-7 pt-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">{label.grid}:</span>
            <button onClick={addRow} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">{label.addRow}</button>
            <button onClick={removeRow} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">{label.removeRow}</button>
            <button onClick={addCol} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">{label.addCol}</button>
            <button onClick={removeCol} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">{label.removeCol}</button>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2 mr-1">{label.deck}:</span>
            <button onClick={addDeck} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">{label.addDeck}</button>
            <button onClick={removeDeck} disabled={layout.decks.length <= 1} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40">{label.removeDeck}</button>
          </div>
        )}

        {/* Direction indicator */}
        <div className="flex items-center gap-2 px-7 pt-4 pb-1 text-xs text-gray-400 font-semibold">
          <span>{label.front}</span>
        </div>

        {/* Seat grid */}
        <div className="px-7 pb-4 overflow-x-auto">
          <div className="inline-block min-w-full">
            {currentDeck.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1.5 mb-1.5 justify-center">
                {row.map((cell, colIdx) => {
                  if (cell.isAisle) {
                    // In position-edit mode, show aisle cells as clickable empty slots
                    if (editable && editMode === 'position') {
                      return (
                        <button
                          key={colIdx}
                          onClick={() => handleCellClick(activeDeck, rowIdx, colIdx)}
                          className="w-10 h-10 flex-shrink-0 rounded-lg border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                          title={language === 'vi' ? 'Nhấp để thêm ghế' : 'Click to add seat'}
                        />
                      );
                    }
                    return (
                      <div
                        key={colIdx}
                        className="w-10 h-10 flex-shrink-0"
                      />
                    );
                  }
                  const isDriver = !!cell.isDriver;
                  const isSleeper = !!cell.isSleeper;
                  const tooltipText = isDriver
                    ? (language === 'vi' ? 'Tài xế' : language === 'ja' ? '運転手' : 'Driver')
                    : cell.discounted
                    ? `${label.available} – ${label.discounted.replace('(', '').replace(')', '')} (${cell.label})`
                    : isSleeper
                    ? `${label.sleeper} (${cell.label})`
                    : `${label.available} (${cell.label})`;
                  const isInteractive = editable && !isDriver &&
                    (editMode === 'discount' || editMode === 'position' || editMode === 'type');
                  return (
                    <button
                      key={colIdx}
                      onClick={() => handleCellClick(activeDeck, rowIdx, colIdx)}
                      disabled={isDriver || !editable || editMode === 'view'}
                      className={cn(
                        'w-10 h-10 rounded-lg text-[10px] font-bold flex-shrink-0 flex items-center justify-center',
                        'border-2 transition-all leading-tight text-center whitespace-pre-wrap',
                        isDriver
                          ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-default'
                          : cell.booked
                          ? 'bg-red-100 border-red-400 text-red-700'
                          : cell.discounted
                          ? 'bg-amber-100 border-amber-400 text-amber-700 ring-2 ring-amber-300'
                          : isSleeper
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-green-50 border-green-300 text-green-800',
                        isInteractive && !cell.booked
                          ? 'cursor-pointer hover:scale-110 hover:shadow-md'
                          : ''
                      )}
                      title={tooltipText}
                    >
                      {isDriver ? '🚌' : showLabels ? cell.label : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 px-7 pb-4 text-xs font-semibold text-gray-600">
          {[
            { color: 'bg-green-50 border-green-300', text: label.available },
            { color: 'bg-indigo-50 border-indigo-300', text: label.sleeper },
            { color: 'bg-red-100 border-red-400', text: label.booked },
            { color: 'bg-amber-100 border-amber-400', text: label.discounted },
          ].map(l => (
            <div key={l.text} className="flex items-center gap-1.5">
              <div className={cn('w-5 h-5 rounded border-2', l.color)} />
              <span>{l.text}</span>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 px-7 pb-7 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
          >
            {label.close}
          </button>
          {editable && onSave && (
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
                isDirty
                  ? 'bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20 hover:scale-105'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              <Save size={15} /> {label.save}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
