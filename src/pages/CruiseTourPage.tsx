import React, { useState, useMemo, useEffect } from 'react';
import { Search, Anchor, Clock, MapPin, ChevronRight, X, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import type { Language } from '../constants/translations';
import type { TourItem } from '../components/TourBookingForm';
import { transportService } from '../services/transportService';

interface CruiseTourPageProps {
  tours: TourItem[];
  language: Language;
  onSelectTour: (tour: TourItem) => void;
}

export const CruiseTourPage: React.FC<CruiseTourPageProps> = ({ tours, language, onSelectTour }) => {
  const isVi = language === 'vi';
  const isJa = language === 'ja';

  const [searchTerm, setSearchTerm] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  // Map of tourId → { roomTypeId → booked count }
  const [allRoomCounts, setAllRoomCounts] = useState<Record<string, Record<string, number>>>({});

  // Stable string of tour IDs – only changes when the set of tours actually changes,
  // preventing getMultipleTourRoomBookingCounts from re-running on every tour data update.
  const tourIdsKey = useMemo(() => tours.map(t => t.id).filter(Boolean).join(','), [tours]);

  // Load room booking counts for all tours whenever the set of tour IDs changes
  useEffect(() => {
    const ids = tourIdsKey.split(',').filter(Boolean);
    if (ids.length === 0) return;
    transportService.getMultipleTourRoomBookingCounts(ids)
      .then(counts => setAllRoomCounts(counts))
      .catch(err => console.error('[CruiseTourPage] room counts error:', err));
  }, [tourIdsKey]);
  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      const q = searchTerm.toLowerCase();
      if (q && !(
        tour.title.toLowerCase().includes(q) ||
        (tour.description || '').toLowerCase().includes(q) ||
        (tour.duration || '').toLowerCase().includes(q)
      )) return false;
      if (durationFilter.trim() && !(tour.duration || '').toLowerCase().includes(durationFilter.toLowerCase())) return false;
      const effectivePrice = tour.roomTypes && tour.roomTypes.length > 0
        ? Math.min(...tour.roomTypes.map(r => r.price))
        : (tour.priceAdult || tour.price);
      if (priceMin !== '' && effectivePrice < Number(priceMin)) return false;
      if (priceMax !== '' && effectivePrice > Number(priceMax)) return false;
      // Filter by departure date (tour.startDate is YYYY-MM-DD; dateFilter is YYYY-MM-DD from input)
      if (dateFilter && tour.startDate && tour.startDate !== dateFilter) return false;
      return true;
    });
  }, [tours, searchTerm, durationFilter, priceMin, priceMax, dateFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setDurationFilter('');
    setPriceMin('');
    setPriceMax('');
    setDateFilter('');
  };

  const hasFilters = searchTerm || durationFilter || priceMin || priceMax || dateFilter;

  const getEffectivePrice = (tour: TourItem): number => {
    if (tour.roomTypes && tour.roomTypes.length > 0) {
      return Math.min(...tour.roomTypes.map(r => r.price));
    }
    return tour.priceAdult || tour.price;
  };

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Anchor className="text-cyan-600" size={26} />
            {isVi ? 'Tour du thuyền' : isJa ? 'クルーズツアー' : 'Cruise Tours'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isVi
              ? 'Khám phá các tour du thuyền sang trọng'
              : isJa
                ? '豪華クルーズツアーをお探しください'
                : 'Explore luxury cruise tour packages'}
          </p>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isVi ? 'Tìm tên hoặc mô tả...' : isJa ? 'ツアー名・説明で検索...' : 'Search tour name or description...'}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
            />
          </div>

          {/* Duration filter */}
          <div className="sm:w-40">
            <input
              type="text"
              value={durationFilter}
              onChange={e => setDurationFilter(e.target.value)}
              placeholder={isVi ? 'VD: 2 ngày...' : isJa ? '例: 2日...' : 'E.g.: 2 days...'}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
            />
          </div>

          {/* Departure date filter */}
          <div className="relative sm:w-44">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              aria-label={isVi ? 'Ngày khởi hành' : isJa ? '出発日' : 'Departure date'}
              className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
            />
          </div>

          {/* Price min */}
          <div className="sm:w-36">
            <input
              type="number"
              min={0}
              value={priceMin}
              onChange={e => setPriceMin(e.target.value)}
              placeholder={isVi ? 'Giá từ (đ)' : isJa ? '最低価格' : 'Price from'}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
            />
          </div>

          {/* Price max */}
          <div className="sm:w-36">
            <input
              type="number"
              min={0}
              value={priceMax}
              onChange={e => setPriceMax(e.target.value)}
              placeholder={isVi ? 'Giá đến (đ)' : isJa ? '最高価格' : 'Price to'}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors whitespace-nowrap"
            >
              <X size={14} />
              {isVi ? 'Xóa lọc' : isJa ? 'クリア' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ── */}
      <p className="text-sm text-gray-500">
        {isVi
          ? `${filteredTours.length} tour du thuyền${filteredTours.length !== tours.length ? ` (lọc từ ${tours.length})` : ''}`
          : isJa
            ? `${filteredTours.length}件のクルーズツアー`
            : `${filteredTours.length} cruise tour${filteredTours.length !== 1 ? 's' : ''}${filteredTours.length !== tours.length ? ` (filtered from ${tours.length})` : ''}`}
      </p>

      {/* ── Tour Cards ── */}
      {filteredTours.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <Anchor size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 font-medium">
            {isVi ? 'Không tìm thấy tour du thuyền nào' : isJa ? 'クルーズツアーが見つかりません' : 'No cruise tours found'}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-cyan-600 text-sm hover:underline"
            >
              {isVi ? 'Xóa bộ lọc' : isJa ? 'フィルターを削除' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTours.map((tour, idx) => {
            const effectivePrice = getEffectivePrice(tour);
            return (
              <motion.div
                key={tour.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
                onClick={() => onSelectTour(tour)}
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  {tour.imageUrl ? (
                    <img
                      src={tour.imageUrl}
                      alt={tour.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-cyan-50">
                      <Anchor size={40} className="text-cyan-300" />
                    </div>
                  )}
                  {tour.discountPercent && tour.discountPercent > 0 ? (
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{tour.discountPercent}%
                    </span>
                  ) : null}
                  {tour.duration && (
                    <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Clock size={11} />
                      {tour.duration}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-cyan-700 transition-colors">
                    {tour.title}
                  </h3>

                  {(tour.departureLocation || tour.returnLocation) && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin size={13} className="text-cyan-500 shrink-0" />
                      <span className="truncate">
                        {tour.departureLocation}
                        {tour.departureLocation && tour.returnLocation && ' → '}
                        {tour.returnLocation}
                      </span>
                    </div>
                  )}

                  {tour.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {tour.description}
                    </p>
                  )}

                  {/* Room types with availability */}
                  {tour.roomTypes && tour.roomTypes.length > 0 && (
                    <div className="space-y-1">
                      {tour.roomTypes.map((rt) => {
                        const bookedCount = allRoomCounts[tour.id]?.[rt.id] ?? 0;
                        const available = rt.totalRooms > 0 ? Math.max(0, rt.totalRooms - bookedCount) : null;
                        const isFullyBooked = available !== null && available <= 0;
                        return (
                          <div
                            key={rt.id}
                            className="flex items-center justify-between text-[10px] px-2 py-1 bg-cyan-50 rounded-lg border border-cyan-100"
                          >
                            <span className="font-medium text-cyan-700">{rt.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-cyan-600 font-semibold">{rt.price.toLocaleString('vi-VN')}đ/{rt.pricingMode === 'PER_ROOM' ? (isVi ? 'phòng' : isJa ? '部屋' : 'room') : (isVi ? 'người' : isJa ? '人' : 'pax')}</span>
                              {available !== null && (
                                <span className={`font-semibold ${isFullyBooked ? 'text-red-500' : available <= 2 ? 'text-amber-500' : 'text-green-600'}`}>
                                  {isFullyBooked
                                    ? (isVi ? 'Hết phòng' : isJa ? '満室' : 'Full')
                                    : (isVi ? `Còn ${available} phòng` : isJa ? `残り${available}室` : `${available} left`)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                        {isVi ? 'Từ' : isJa ? '料金' : 'From'}
                      </p>
                      <p className="text-lg font-extrabold text-cyan-700">
                        {effectivePrice.toLocaleString('vi-VN')}
                        <span className="text-xs font-semibold text-gray-400 ml-0.5">đ</span>
                      </p>
                    </div>
                    <button
                      className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shadow-sm"
                      onClick={e => { e.stopPropagation(); onSelectTour(tour); }}
                    >
                      {isVi ? 'Đặt tour' : isJa ? '予約' : 'Book'}
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CruiseTourPage;

