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

// ─── Layout generators ──────────────────────────────────────────────────────

function busRow(labels: (string | null)[]): SeatCell[] {
  return labels.map(l =>
    l === null ? { label: '', isAisle: true } : { label: l }
  );
}

function busLayout(seatCount: number): DeckLayout {
  const rows: SeatCell[][] = [];
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

function minivanLayout(seatCount: number): DeckLayout {
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

  if (typeLower.includes('giường') || typeLower.includes('sleeper')) {
    const { lower, upper } = sleeperLayout(seatCount);
    return { decks: [lower, upper] };
  }

  if (typeLower.includes('cabin') || typeLower.includes('vip')) {
    return { decks: [cabinLayout(seatCount)] };
  }

  if (typeLower.includes('limousine') || typeLower.includes('limo') || typeLower.includes('luxury')) {
    return { decks: [limousineLayout(seatCount)] };
  }

  if (seatCount <= 7) return { decks: [minivanLayout(seatCount)] };
  if (seatCount <= 11) return { decks: [van10Layout(seatCount)] };

  return { decks: [busLayout(seatCount)] };
}

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

// Keep busRow exported for consumers that might use it
export { busRow };
