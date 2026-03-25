import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bus, Star, UserPlus, Search, Package, Building2, Anchor, Map, LayoutGrid, Ticket, ChevronRight, ChevronLeft, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { TRANSLATIONS } from '../constants/translations';
import { UserRole } from '../constants/translations';
import { Footer } from '../components/Footer';
import type { Language } from '../constants/translations';
import type { User } from '../types';
import type { Agent } from '../types';

interface HomePageProps {
  language: Language;
  currentUser: User | null;
  agents: Agent[];
  setActiveTab: (tab: string) => void;
  setAgentTopUpModal: (open: boolean) => void;
}

const HERO_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/hinhnenhome.png?alt=media&token=4be06677-5484-4225-a48f-2a7f92dc99f4';
const TOUR_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/tours%2F1773789577464_tourHagiang.jpg?alt=media&token=eb94d1e8-52c1-4049-a6ee-7604fe17af93';
const CRUISE_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/tours%2Fcruise%20sangtrong.png?alt=media&token=d27309e2-4e20-41b2-a4a9-100e67af6212';
const YOUTUBE_VIDEO_ID = 'Uqhsq1MYIZk';
const CAROUSEL_GAP = 16; // px – matches gap-4

export function HomePage({ language, currentUser, agents, setActiveTab, setAgentTopUpModal }: HomePageProps) {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');

  // ── Carousel state ──
  const [slideIdx, setSlideIdx] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isVi = language === 'vi';
  const isJa = language === 'ja';

  // ── Responsive container width tracking ──
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const services = [
    {
      title: t.feature_limo_title,
      desc: t.feature_limo_desc,
      icon: Bus,
      tab: 'book-ticket',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      image: HERO_IMAGE_URL,
      type: 'service' as const,
    },
    {
      title: t.feature_tour_title,
      desc: t.feature_tour_desc,
      icon: Star,
      tab: 'tours',
      color: 'text-green-600',
      bg: 'bg-green-50',
      image: TOUR_IMAGE_URL,
      type: 'service' as const,
    },
    {
      title: isVi ? 'Cruise Sang Trọng' : isJa ? '豪華クルーズ' : 'Luxury Cruise',
      desc: isVi ? 'Du thuyền cao cấp, trải nghiệm đẳng cấp.' : isJa ? '高級クルーズ体験。' : 'Premium cruise experience.',
      icon: Anchor,
      tab: 'book-ticket',
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      image: CRUISE_IMAGE_URL,
      type: 'service' as const,
    },
  ];

  type ServiceCard = typeof services[number];
  type YoutubeCard = { type: 'youtube'; title: string; youtubeId: string; icon: typeof Play; tab: string; color: string; bg: string };
  type AnyCard = ServiceCard | YoutubeCard;

  const youtubeCard: YoutubeCard = {
    type: 'youtube',
    title: isVi ? 'Video Nổi Bật' : isJa ? '注目動画' : 'Featured Video',
    youtubeId: YOUTUBE_VIDEO_ID,
    icon: Play,
    tab: 'book-ticket',
    color: 'text-red-600',
    bg: 'bg-red-50',
  };

  const allCards: AnyCard[] = [...services, youtubeCard];
  const totalCards = allCards.length;

  const visibleCount = containerWidth > 0 && containerWidth >= 640 ? 3 : 1;
  const cardWidth = containerWidth > 0 ? (containerWidth - CAROUSEL_GAP * (visibleCount - 1)) / visibleCount : 0;
  const slotWidth = cardWidth + CAROUSEL_GAP;
  const maxIdx = Math.max(0, totalCards - visibleCount);

  // goTo wraps around for consistent UX with auto-play
  const goTo = useCallback((idx: number) => {
    setSlideIdx(((idx % (maxIdx + 1)) + (maxIdx + 1)) % (maxIdx + 1));
  }, [maxIdx]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlideIdx(prev => (prev >= maxIdx ? 0 : prev + 1));
    }, 3500);
  }, [maxIdx]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const heroTagline = isVi
    ? 'Tour, xe & nhiều khuyến mại hấp dẫn khác'
    : isJa
    ? 'ツアー、バス、お得なプランが揃っています'
    : 'Tours, buses & many great deals';

  const categories = [
    {
      label: isVi ? 'Vé bus' : isJa ? 'バス券' : 'Bus Tickets',
      icon: Bus,
      tab: 'book-ticket',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: isVi ? 'Du thuyền' : isJa ? 'クルーズ' : 'Cruise',
      icon: Anchor,
      tab: 'book-ticket',
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      label: isVi ? 'Tour' : isJa ? 'ツアー' : 'Tour',
      icon: Map,
      tab: 'tours',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: isVi ? 'Khách sạn' : isJa ? 'ホテル' : 'Hotel',
      icon: Building2,
      tab: 'book-ticket',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: isVi ? 'Gửi hàng' : isJa ? '貨物' : 'Cargo',
      icon: Package,
      tab: 'consignments',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: isVi ? 'Tất cả các mục' : isJa ? 'すべて' : 'All',
      icon: LayoutGrid,
      tab: 'book-ticket',
      color: 'text-gray-600',
      bg: 'bg-gray-100',
    },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveTab('book-ticket');
  };

  return (
    <div className="space-y-5">
      {/* ── Hero Banner ── */}
      <div className="relative rounded-[32px] overflow-hidden min-h-[200px] sm:min-h-[260px]">
        <img
          src={HERO_IMAGE_URL}
          alt="Travel Hero"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between h-full min-h-[200px] sm:min-h-[260px] px-5 sm:px-10 py-6 sm:py-8">
          {/* Top row: branding + quick action icons */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-daiichi-red rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <Bus size={18} className="text-white" />
              </div>
              <div>
                <span className="font-extrabold text-white text-sm tracking-wide leading-none block">DAIICHI TRAVEL</span>
                <span className="text-white/60 text-[10px] leading-none">{heroTagline}</span>
              </div>
            </div>
            {/* Quick icon shortcuts */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('book-ticket')}
                className="w-9 h-9 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white transition-all gap-0.5"
                title={isVi ? 'Tìm kiếm' : 'Search'}
              >
                <Search size={14} />
                <span className="text-[8px] font-medium leading-none">{isVi ? 'Tìm' : isJa ? '検索' : 'Search'}</span>
              </button>
              <button
                onClick={() => setActiveTab('book-ticket')}
                className="w-9 h-9 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white transition-all gap-0.5"
                title={isVi ? 'Giỏ hàng' : 'Cart'}
              >
                <Ticket size={14} />
                <span className="text-[8px] font-medium leading-none">{isVi ? 'Giỏ hàng' : isJa ? 'カート' : 'Cart'}</span>
              </button>
              <button
                onClick={() => setActiveTab(currentUser && currentUser.id !== 'guest' ? 'my-tickets' : 'book-ticket')}
                className="w-9 h-9 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-white transition-all gap-0.5"
                title={isVi ? 'Tài khoản' : 'Account'}
              >
                <UserPlus size={14} />
                <span className="text-[8px] font-medium leading-none">{isVi ? 'Tài khoản' : isJa ? 'アカウント' : 'Account'}</span>
              </button>
              {/* App download badge */}
              <div className="hidden sm:flex w-auto px-2 h-9 bg-daiichi-red rounded-xl items-center justify-center gap-1 cursor-default">
                <span className="text-white text-[10px] font-bold whitespace-nowrap">{isVi ? 'Tải áp' : isJa ? 'アプリ' : 'Get App'}</span>
              </div>
            </div>
          </div>

          {/* Hero title + CTA buttons */}
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl sm:text-3xl font-bold text-white leading-tight max-w-xs sm:max-w-md mb-3"
            >
              {t.hero_title}
            </motion.h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('book-ticket')}
                className="px-4 py-2 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/30 hover:scale-105 transition-all text-sm"
              >
                {t.book_now}
              </button>
              <button
                onClick={() => setActiveTab('tours')}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white border border-white/40 rounded-xl font-bold hover:bg-white/30 transition-all text-sm"
              >
                {t.view_hot_tours}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global Search Bar ── */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={isVi ? 'Tìm kiếm tour, vé xe, dịch vụ...' : isJa ? 'ツアー、チケット、サービスを検索...' : 'Search tours, tickets, services...'}
          className="w-full pl-11 pr-20 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20 focus:border-daiichi-red/40 hover:border-gray-300 transition-colors"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-daiichi-red text-white rounded-xl text-xs font-bold hover:bg-daiichi-red/90 transition-colors"
        >
          {isVi ? 'Tìm kiếm' : isJa ? '検索' : 'Search'}
        </button>
      </form>

      {/* ── Category Shortcuts ── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveTab(cat.tab)}
              className="flex flex-col items-center gap-2 py-2 px-1 rounded-2xl hover:bg-gray-50 active:scale-95 transition-all group"
            >
              <div className={`w-12 h-12 ${cat.bg} ${cat.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
                <cat.icon size={22} />
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-600 text-center leading-tight">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Agent balance banner – shown when agent is logged in ── */}
      {currentUser?.role === UserRole.AGENT && (() => {
        const agentData = agents.find(a => a.id === currentUser.id);
        if (!agentData) return null;
        return (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-5 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                </svg>
              </div>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  {isVi ? 'Số dư tài khoản đại lý' : 'Agent Account Balance'}
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                  <span className={(agentData.balance || 0) < 0 ? 'text-red-300' : 'text-white'}>
                    {(agentData.balance || 0).toLocaleString('vi-VN')}đ
                  </span>
                </p>
                <p className="text-white/60 text-xs mt-1">{agentData.name} · {agentData.code}</p>
              </div>
            </div>
            <button
              onClick={() => setAgentTopUpModal(true)}
              className="shrink-0 flex items-center gap-2 px-5 py-3 bg-white text-purple-700 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all text-sm whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1"/>
                <rect width="5" height="5" x="16" y="3" rx="1"/>
                <rect width="5" height="5" x="3" y="16" rx="1"/>
                <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                <path d="M21 21v.01"/>
                <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                <path d="M3 12h.01"/>
                <path d="M12 3h.01"/>
                <path d="M12 16v.01"/>
                <path d="M16 12h1"/>
                <path d="M21 12v.01"/>
                <path d="M12 21v-1"/>
              </svg>
              {isVi ? 'Nạp tiền' : 'Top Up'}
            </button>
          </div>
        );
      })()}

      {/* ── Product / Services Carousel ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg font-bold text-gray-800">
            {isVi ? 'Sản phẩm & dịch vụ nổi bật' : isJa ? '注目のサービス' : 'Featured Services'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { goTo(slideIdx - 1); resetTimer(); }}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
              aria-label="Previous"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => { goTo(slideIdx + 1); resetTimer(); }}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all"
              aria-label="Next"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setActiveTab('book-ticket')}
              className="flex items-center gap-1 text-daiichi-red text-xs font-semibold hover:underline ml-1"
            >
              {isVi ? 'Xem tất cả' : isJa ? 'すべて見る' : 'View all'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Carousel track */}
        <div ref={carouselRef} className="overflow-hidden">
          <div
            className="flex gap-4"
            style={{
              transform: containerWidth > 0 ? `translateX(-${slideIdx * slotWidth}px)` : undefined,
              transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {allCards.map((card, i) => (
              <div
                key={i}
                style={{ width: cardWidth > 0 ? cardWidth : undefined, flexShrink: 0 }}
              >
                {card.type === 'youtube' ? (
                  /* ── YouTube card ── */
                  <a
                    href={`https://youtu.be/${card.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group h-64 block"
                  >
                    <div className="flex-[9] min-h-0 relative overflow-hidden bg-black">
                      <img
                        src={`https://i.ytimg.com/vi/${card.youtubeId}/hqdefault.jpg`}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85"
                        loading="lazy"
                        decoding="async"
                      />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                          <Play size={22} className="text-white ml-1" fill="white" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-[1] min-h-0 bg-white flex items-center gap-2 px-4 border-t border-gray-100 overflow-hidden">
                      <div className="w-6 h-6 bg-red-50 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Play size={13} fill="currentColor" />
                      </div>
                      <span className="font-bold text-gray-900 text-sm truncate">{card.title}</span>
                    </div>
                  </a>
                ) : (
                  /* ── Service card ── */
                  <div
                    onClick={() => setActiveTab(card.tab)}
                    className="flex flex-col rounded-3xl border border-gray-100 shadow-sm hover:shadow-md cursor-pointer transition-all overflow-hidden group h-64"
                  >
                    <div className="flex-[9] min-h-0 overflow-hidden">
                      <img
                        src={card.image}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="flex-[1] min-h-0 bg-white flex items-center gap-2 px-4 border-t border-gray-100 overflow-hidden">
                      <div className={`w-6 h-6 ${card.bg} ${card.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <card.icon size={13} />
                      </div>
                      <span className="font-bold text-gray-900 text-sm truncate">{card.title}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: maxIdx + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIdx ? 'w-5 bg-daiichi-red' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── Membership invitation banner – shown only to unregistered guests ── */}
      {currentUser?.id === 'guest' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-r from-daiichi-red to-rose-500 rounded-[32px] p-7 sm:p-12 text-white"
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <UserPlus size={28} />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold mb-1">
                  {t.member_banner_title || 'Trở Thành Thành Viên Daiichi Travel!'}
                </h3>
                <p className="text-white/80 text-sm max-w-lg leading-relaxed">
                  {t.member_banner_subtitle || 'Đặt vé ngay để đăng ký thành viên miễn phí – tích lũy điểm thưởng, nhận ưu đãi độc quyền và được gợi ý chuyến xe cá nhân hóa.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('book-ticket')}
              className="shrink-0 px-6 py-3 sm:px-8 sm:py-4 bg-white text-daiichi-red rounded-2xl font-bold shadow-lg hover:scale-105 transition-all text-sm sm:text-base whitespace-nowrap"
            >
              {t.member_banner_cta || 'Đặt vé & Đăng ký'}
            </button>
          </div>
          <div className="absolute -right-10 -top-10 w-52 h-52 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -right-4 -bottom-6 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />
        </motion.div>
      )}

      <Footer language={language} />
    </div>
  );
}
