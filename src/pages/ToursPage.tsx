import React from 'react';
import { Heart, Search, Star, Calendar } from 'lucide-react';
import { getYoutubeEmbedUrl } from '../lib/utils';
import { TRANSLATIONS, Language } from '../constants/translations';
import type { TourItem } from '../components/TourBookingForm';

interface ToursPageProps {
  tours: TourItem[];
  tourHasSearched: boolean;
  clearedTourCards: Set<string>;
  tourPriceMin: string;
  tourPriceMax: string;
  tourDurationFilter: string;
  tourDateFilter: string;
  expandedVideoTourId: string | null;
  likedTours: Set<string>;
  language: Language;
  setTourHasSearched: (v: boolean) => void;
  setClearedTourCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  setTourPriceMin: (v: string) => void;
  setTourPriceMax: (v: string) => void;
  setTourDurationFilter: (v: string) => void;
  setTourDateFilter: (v: string) => void;
  setExpandedVideoTourId: (v: string | null) => void;
  toggleLike: (tourId: string) => void;
  onSelectTour: (tour: TourItem) => void;
}

export function ToursPage({
  tours,
  tourHasSearched,
  clearedTourCards,
  tourPriceMin,
  tourPriceMax,
  tourDurationFilter,
  tourDateFilter,
  expandedVideoTourId,
  likedTours,
  language,
  setTourHasSearched,
  setClearedTourCards,
  setTourPriceMin,
  setTourPriceMax,
  setTourDurationFilter,
  setTourDateFilter,
  setExpandedVideoTourId,
  toggleLike,
  onSelectTour,
}: ToursPageProps) {
  const t = TRANSLATIONS[language];

  // Apply advanced filters
  const filteredPublicTours = tours.filter(tour => {
    const tourPriceAdult = tour.priceAdult || tour.price;
    const tourPriceChild = tour.priceChild ?? Math.round(tourPriceAdult * 0.5);
    const effectivePrice =
      tourPriceAdult * (tour.numAdults ?? 1) +
      tourPriceChild * (tour.numChildren ?? 0) +
      (tour.nights ?? 0) * (tour.pricePerNight ?? 0) +
      (tour.breakfastCount ?? 0) * (tour.pricePerBreakfast ?? 0) +
      (tour.surcharge ?? 0);
    if (tourDurationFilter) {
      const q = tourDurationFilter.toLowerCase();
      const matchesTitle = tour.title.toLowerCase().includes(q);
      const matchesDescription = (tour.description || '').toLowerCase().includes(q);
      const matchesDuration = (tour.duration || '').toLowerCase().includes(q);
      if (!matchesTitle && !matchesDescription && !matchesDuration) return false;
    }
    // Filter by departure date (tour.startDate is YYYY-MM-DD; tourDateFilter is also YYYY-MM-DD from date input)
    if (tourDateFilter && tour.startDate && tour.startDate !== tourDateFilter) return false;
    if (tourPriceMin) {
      const min = parseInt(tourPriceMin);
      if (!isNaN(min) && effectivePrice < min) return false;
    }
    if (tourPriceMax) {
      const max = parseInt(tourPriceMax);
      if (!isNaN(max) && effectivePrice > max) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">{t.tours}</h2>
        <p className="text-sm text-gray-500">{language === 'vi' ? 'Khám phá các tour du lịch hấp dẫn' : 'Explore our amazing tour packages'}</p>
      </div>

      {/* Advanced search bar */}
      <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Tìm kiếm tour' : 'Search tours'}</label>
            <div className="relative mt-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
               <input
                 type="text"
                 value={tourDurationFilter}
                 onChange={e => setTourDurationFilter(e.target.value)}
                 placeholder={language === 'vi' ? 'Tìm theo tên, nội dung, thời gian...' : 'Search by name, content, duration...'}
                 className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
               />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="tour-date-filter" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Ngày khởi hành' : 'Departure date'}</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                <input
                  id="tour-date-filter"
                  type="date"
                  value={tourDateFilter}
                  onChange={e => setTourDateFilter(e.target.value)}
                  className="pl-8 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'Giá từ (đ)' : 'Price from'}</label>
              <input
                type="number"
                min="0"
                value={tourPriceMin}
                onChange={e => setTourPriceMin(e.target.value)}
                placeholder=""
                className="mt-1 w-32 px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{language === 'vi' ? 'đến (đ)' : 'to'}</label>
              <input
                type="number"
                min="0"
                value={tourPriceMax}
                onChange={e => setTourPriceMax(e.target.value)}
                placeholder="∞"
                className="mt-1 w-32 px-3 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10"
              />
            </div>
            <button
              onClick={() => setTourHasSearched(true)}
              className="px-6 py-3 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all flex items-center gap-2"
            >
              <Search size={16} />
              {language === 'vi' ? 'Tìm' : 'Search'}
            </button>
            {(tourDurationFilter || tourPriceMin || tourPriceMax || tourDateFilter) && (
              <button
                onClick={() => { setTourDurationFilter(''); setTourPriceMin(''); setTourPriceMax(''); setTourDateFilter(''); setTourHasSearched(false); }}
                className="px-4 py-3 text-gray-400 hover:text-gray-600 text-sm"
              >
                {language === 'vi' ? 'Xóa bộ lọc' : 'Clear'}
              </button>
            )}
          </div>
        </div>
      </div>

      {tours.length === 0 ? (
        <div className="text-center py-20">
          <Star className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-400">{language === 'vi' ? 'Chưa có tour nào. Liên hệ để biết thêm!' : 'No tours available yet. Contact us for more info!'}</p>
        </div>
      ) : filteredPublicTours.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{language === 'vi' ? 'Không tìm thấy tour phù hợp' : 'No tours match your search'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPublicTours.map((tour) => {
            const allTourImages = tour.images && tour.images.length > 0
              ? tour.images
              : (tour.imageUrl ? [tour.imageUrl] : []);
            const effectiveAdultPrice = tour.priceAdult || tour.price;
            const effectiveChildPrice = tour.priceChild ?? Math.round(effectiveAdultPrice * 0.5);
            const fullTourPrice =
              effectiveAdultPrice * (tour.numAdults ?? 1) +
              effectiveChildPrice * (tour.numChildren ?? 0) +
              (tour.nights ?? 0) * (tour.pricePerNight ?? 0) +
              (tour.breakfastCount ?? 0) * (tour.pricePerBreakfast ?? 0) +
              (tour.surcharge ?? 0);
            const discountedFullPrice = tour.discountPercent && tour.discountPercent > 0
              ? Math.round(fullTourPrice * (1 - tour.discountPercent / 100))
              : null;
            const displayImg = allTourImages[0] || '';
            const isLiked = likedTours.has(tour.id);
            const embedUrl = tour.youtubeUrl ? getYoutubeEmbedUrl(tour.youtubeUrl) : null;
            const isTourRevealed = tourHasSearched || clearedTourCards.has(tour.id);
            return (
              <div key={tour.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className="relative h-48 overflow-hidden">
                  {displayImg && (
                    <img
                      src={displayImg}
                      alt={tour.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                      style={{ filter: isTourRevealed ? 'none' : 'blur(10px)', transform: isTourRevealed ? 'scale(1)' : 'scale(1.1)' }}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {!isTourRevealed && displayImg && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                      onClick={() => setClearedTourCards(prev => new Set([...prev, tour.id]))}
                    >
                      <span className="text-white text-xs font-bold bg-black/40 px-3 py-1 rounded-full">
                        {language === 'vi' ? '👆 Chạm để xem ảnh' : '👆 Tap to reveal'}
                      </span>
                    </div>
                  )}
                  {allTourImages.length > 1 && isTourRevealed && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      +{allTourImages.length - 1} {language === 'vi' ? 'ảnh' : 'photos'}
                    </div>
                  )}
                  {tour.discountPercent && tour.discountPercent > 0 ? (
                    <div className="absolute top-4 left-4 bg-daiichi-red text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      -{tour.discountPercent}% {language === 'vi' ? 'GIẢM' : 'OFF'}
                    </div>
                  ) : null}
                  {tour.duration && (
                    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold">
                      {tour.duration}
                    </div>
                  )}
                </div>
                {/* YouTube video embed */}
                {embedUrl && (
                  <div className="border-t border-gray-100">
                    {expandedVideoTourId === tour.id ? (
                      <div>
                        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                          <iframe
                            src={embedUrl}
                            title={tour.title}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <button
                          onClick={() => setExpandedVideoTourId(null)}
                          className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
                        >
                          <span>▲</span> {language === 'vi' ? 'Ẩn video' : 'Hide video'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpandedVideoTourId(tour.id)}
                        className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <span className="w-7 h-7 bg-daiichi-red text-white rounded-full flex items-center justify-center text-xs">▶</span>
                        {language === 'vi' ? 'Xem video tour' : 'Watch tour video'}
                      </button>
                    )}
                  </div>
                )}
                <div className="p-6">
                  <h4 className="text-lg font-bold mb-1">{tour.title}</h4>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{tour.description}</p>
                  {/* Overnight & Breakfast badges */}
                  {((tour.nights ?? 0) > 0 || (tour.breakfastCount ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(tour.nights ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          🌙 {tour.nights} {language === 'vi' ? 'đêm' : 'nights'}
                        </span>
                      )}
                      {(tour.breakfastCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          ☕ {tour.breakfastCount} {language === 'vi' ? 'bữa sáng' : 'breakfasts'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Giá toàn tour' : 'Total tour price'}</p>
                      {discountedFullPrice !== null ? (
                        <>
                          <p className="text-sm text-gray-400 line-through">{fullTourPrice.toLocaleString()}đ</p>
                          <p className="text-2xl font-extrabold text-daiichi-red">{discountedFullPrice.toLocaleString()}đ</p>
                        </>
                      ) : (
                        <p className="text-2xl font-extrabold text-daiichi-red">{fullTourPrice.toLocaleString()}đ</p>
                      )}
                      <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Đơn giá người lớn' : 'Adult unit price'}: {effectiveAdultPrice.toLocaleString()}đ/{language === 'vi' ? 'người' : 'person'}</p>
                      {effectiveChildPrice > 0 && (
                        <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Đơn giá trẻ em (dưới 4 tuổi)' : 'Child unit price (<4 yrs)'}: {effectiveChildPrice.toLocaleString()}đ/{language === 'vi' ? 'người' : 'person'}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectTour(tour)}
                        className="px-5 py-2.5 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-105 transition-all text-sm"
                      >
                        {t.book_tour || (language === 'vi' ? 'Đặt tour' : 'Book Tour')}
                      </button>
                      <button
                        onClick={() => toggleLike(tour.id)}
                        className={`p-2.5 rounded-xl border transition-all hover:scale-110 ${isLiked ? 'bg-pink-50 border-pink-200 text-pink-500' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-pink-400'}`}
                        title={isLiked ? (language === 'vi' ? 'Bỏ thích' : 'Unlike') : (language === 'vi' ? 'Thích tour này' : 'Like this tour')}
                      >
                        <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
