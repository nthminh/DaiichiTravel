import React, { useState, useRef, useMemo } from 'react';
import {
  Bus, Car, BedDouble, LayoutGrid, Star, Phone, UserPlus,
  ArrowUpDown, Search, ShoppingBag, User as UserIcon, Download, Ship,
  MapPin, Package, Ticket, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TRANSLATIONS } from '../constants/translations';
import { UserRole } from '../constants/translations';
import { Footer } from '../components/Footer';
import type { Language } from '../constants/translations';
import type { User, Agent, Stop, Route } from '../types';
import { matchesSearch } from '../lib/searchUtils';

interface HomePageProps {
  language: Language;
  currentUser: User | null;
  agents: Agent[];
  stops: Stop[];
  routes: Route[];
  setActiveTab: (tab: string) => void;
  setAgentTopUpModal: (open: boolean) => void;
  setSearchFrom: (v: string) => void;
  setSearchTo: (v: string) => void;
  setVehicleTypeFilter: (v: string) => void;
}

const VEHICLE_TYPES = [
  { id: 'bus45',     label_vi: 'Bus 45 chỗ',        label_en: 'Bus 45 seats',   icon: Bus,        filter: 'Bus 45' },
  { id: 'limousine', label_vi: 'Limousine',           label_en: 'Limousine',      icon: Car,        filter: 'Limousine' },
  { id: 'xe7',       label_vi: 'Xe 7 ghế',            label_en: '7-seater',       icon: Car,        filter: 'Xe 7' },
  { id: 'cabin24',   label_vi: 'Cabin 24',             label_en: 'Cabin 24',       icon: BedDouble,  filter: 'Cabin' },
  { id: 'giuong',    label_vi: 'Giường khách sạn',    label_en: 'Sleeper bus',    icon: BedDouble,  filter: 'Giường' },
  { id: 'all',       label_vi: 'Tất cả xe khác',      label_en: 'All vehicles',   icon: LayoutGrid, filter: '' },
];

const CATEGORIES = [
  { id: 'bus',    label_vi: 'Vé bus',     label_en: 'Bus ticket', Icon: Bus,        tab: 'book-ticket' },
  { id: 'cruise', label_vi: 'Du thuyền',  label_en: 'Cruise',     Icon: Ship,       tab: 'book-ticket' },
  { id: 'tour',   label_vi: 'Tour',        label_en: 'Tour',       Icon: Star,       tab: 'tours' },
  { id: 'hotel',  label_vi: 'Khách sạn',  label_en: 'Hotel',      Icon: MapPin,     tab: 'book-ticket' },
  { id: 'ship',   label_vi: 'Gửi hàng',   label_en: 'Shipping',   Icon: Package,    tab: 'consignments' },
  { id: 'all',    label_vi: 'Tất cả',     label_en: 'All',        Icon: LayoutGrid, tab: 'book-ticket' },
];

/** Simple autocomplete input for departure / destination stops */
function StopInput({
  value,
  onChange,
  placeholder,
  stops,
  inputRef,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  stops: Stop[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (!value.trim()) return stops.slice(0, 8);
    return stops.filter(s => matchesSearch(s.name, value)).slice(0, 8);
  }, [value, stops]);

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-2 px-3 py-3">
        <MapPin size={16} className="text-daiichi-red shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { setOpen(true); onFocus?.(); }}
          onBlur={() => setTimeout(() => { setOpen(false); onBlur?.(); }, 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
        />
        {value && (
          <button onClick={() => onChange('')} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-52 overflow-y-auto"
          >
            {suggestions.map(s => (
              <li key={s.id}>
                <button
                  onMouseDown={() => onChange(s.name)}
                  className="w-full text-left px-4 py-2.5 hover:bg-daiichi-accent text-sm text-gray-700 flex items-center gap-2"
                >
                  <MapPin size={13} className="text-daiichi-red shrink-0" />
                  {s.name}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HomePage({
  language,
  currentUser,
  agents,
  stops,
  routes,
  setActiveTab,
  setAgentTopUpModal,
  setSearchFrom,
  setSearchTo,
  setVehicleTypeFilter,
}: HomePageProps) {
  const t = TRANSLATIONS[language];

  const [fromValue, setFromValue] = useState('');
  const [toValue, setToValue] = useState('');
  const [activeVehicle, setActiveVehicle] = useState('');

  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  // Only TERMINAL stops shown in search suggestions
  const terminalStops = useMemo(
    () => stops.filter(s => !s.type || s.type === 'TERMINAL'),
    [stops]
  );

  // Routes with images – shown as featured cards
  const featuredRoutes = useMemo(
    () => routes.filter(r => r.imageUrl).slice(0, 6),
    [routes]
  );

  function handleSwap() {
    const tmp = fromValue;
    setFromValue(toValue);
    setToValue(tmp);
  }

  function handleSearch() {
    setSearchFrom(fromValue);
    setSearchTo(toValue);
    setVehicleTypeFilter(activeVehicle);
    setActiveTab('book-ticket');
  }

  function handleVehicleType(filter: string) {
    setActiveVehicle(filter);
    setVehicleTypeFilter(filter);
  }

  return (
    <div className="space-y-6 pb-4">

      {/* ── HERO BANNER ──────────────────────────────────────────────── */}
      <div className="relative rounded-[28px] overflow-hidden">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/hinhnenhome.png?alt=media&token=4be06677-5484-4225-a48f-2a7f92dc99f4"
          alt="Travel Hero"
          className="w-full h-36 sm:h-52 object-cover"
          referrerPolicy="no-referrer"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent flex flex-col justify-between p-4 sm:p-6">
          {/* Top bar: logo + cart + account */}
          <div className="flex items-center justify-between">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724"
              alt="Daiichi Travel"
              className="h-7 sm:h-9 object-contain drop-shadow"
              loading="eager"
              decoding="async"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('my-tickets')}
                title={language === 'vi' ? 'Vé của tôi' : 'My Tickets'}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
              >
                <Ticket size={16} />
              </button>
              <button
                onClick={() => setActiveTab('book-ticket')}
                title={language === 'vi' ? 'Giỏ hàng / Đặt vé' : 'Cart / Book Ticket'}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
              >
                <ShoppingBag size={16} />
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                title={language === 'vi' ? 'Tài khoản thành viên' : 'Member Account'}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
              >
                <UserIcon size={16} />
              </button>
              <button
                onClick={() => {
                  const el = document.querySelector<HTMLButtonElement>('[data-pwa-install]');
                  if (el) el.click();
                }}
                title={language === 'vi' ? 'Tải áp' : 'Download app'}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-daiichi-red rounded-xl text-white text-xs font-bold hover:bg-red-600 transition-all"
              >
                <Download size={13} />
                {language === 'vi' ? 'Tải áp' : 'Get app'}
              </button>
            </div>
          </div>

          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-white font-bold text-base sm:text-xl leading-snug drop-shadow">
              {language === 'vi'
                ? 'Vé xe khách khắp Việt Nam & hơn thế nữa'
                : 'Bus tickets across Vietnam & beyond'}
            </p>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5">
              {language === 'vi'
                ? 'Lựa chọn dòng xe yêu thích của bạn'
                : 'Choose the vehicle type you love'}
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── VEHICLE TYPE ICONS ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {VEHICLE_TYPES.map(vt => {
            const Icon = vt.icon;
            const isActive = activeVehicle === vt.filter;
            return (
              <button
                key={vt.id}
                onClick={() => handleVehicleType(vt.filter)}
                className={`flex flex-col items-center gap-1.5 min-w-[64px] px-2 py-2 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-daiichi-red/10 text-daiichi-red'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  isActive ? 'bg-daiichi-red text-white' : 'bg-daiichi-accent text-daiichi-red'
                }`}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">
                  {language === 'vi' ? vt.label_vi : vt.label_en}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SEARCH FORM ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible">
        <div className="relative">
          {/* Departure */}
          <StopInput
            value={fromValue}
            onChange={setFromValue}
            placeholder={language === 'vi' ? 'Chọn điểm đi' : 'Departure point'}
            stops={terminalStops}
            inputRef={fromRef}
          />

          {/* Divider + swap button */}
          <div className="relative flex items-center px-4">
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <button
              onClick={handleSwap}
              title={language === 'vi' ? 'Đổi chiều' : 'Swap'}
              className="mx-2 w-8 h-8 rounded-full bg-daiichi-accent border border-gray-200 flex items-center justify-center text-daiichi-red hover:bg-daiichi-red hover:text-white hover:border-daiichi-red transition-all shadow-sm"
            >
              <ArrowUpDown size={15} />
            </button>
            <div className="flex-1 border-t border-dashed border-gray-200" />
          </div>

          {/* Destination */}
          <StopInput
            value={toValue}
            onChange={setToValue}
            placeholder={language === 'vi' ? 'Chọn điểm đến' : 'Destination point'}
            stops={terminalStops}
            inputRef={toRef}
          />
        </div>

        {/* Search button */}
        <div className="p-3 pt-2">
          <button
            onClick={handleSearch}
            className="w-full flex items-center justify-center gap-2 py-3 bg-daiichi-red text-white rounded-2xl font-bold text-sm hover:bg-red-600 active:scale-[.98] transition-all shadow-md shadow-daiichi-red/20"
          >
            <Search size={16} />
            {language === 'vi' ? 'Tìm kiếm' : 'Search'}
          </button>
        </div>
      </div>

      {/* ── CATEGORY ICONS ───────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map(cat => {
            const Icon = cat.Icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.tab)}
                className="flex flex-col items-center gap-1.5 min-w-[60px] px-2 py-2 rounded-2xl text-gray-600 hover:bg-daiichi-accent hover:text-daiichi-red transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-daiichi-accent flex items-center justify-center text-daiichi-red">
                  <Icon size={18} />
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">
                  {language === 'vi' ? cat.label_vi : cat.label_en}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AGENT BALANCE BANNER ─────────────────────────────────────── */}
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
                  {language === 'vi' ? 'Số dư tài khoản đại lý' : 'Agent Account Balance'}
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
              {language === 'vi' ? 'Nạp tiền' : 'Top Up'}
            </button>
          </div>
        );
      })()}

      {/* ── FEATURED ROUTES ──────────────────────────────────────────── */}
      {featuredRoutes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">
              {language === 'vi' ? 'Tuyến đường nổi bật' : 'Featured Routes'}
            </h3>
            <button
              onClick={() => setActiveTab('book-ticket')}
              className="flex items-center gap-1 text-daiichi-red text-xs font-semibold hover:underline"
            >
              {language === 'vi' ? 'Xem tất cả' : 'View all'}
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {featuredRoutes.map(route => (
              <motion.button
                key={route.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSearchFrom(route.departurePoint);
                  setSearchTo(route.arrivalPoint);
                  setActiveTab('book-ticket');
                }}
                className="relative rounded-2xl overflow-hidden text-left shadow-sm border border-gray-100 group"
              >
                <img
                  src={route.imageUrl}
                  alt={route.name}
                  className="w-full h-28 sm:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-white font-bold text-xs leading-tight drop-shadow">
                    {route.departurePoint} → {route.arrivalPoint}
                  </p>
                  <p className="text-white/80 text-[10px] mt-0.5">
                    {route.price.toLocaleString('vi-VN')}đ
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── FEATURES GRID (fallback when no featured routes) ─────────── */}
      {featuredRoutes.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: t.feature_limo_title, desc: t.feature_limo_desc, icon: Bus },
            { title: t.feature_tour_title, desc: t.feature_tour_desc, icon: Star },
            { title: t.feature_support_title, desc: '+84 96 100 47 09', icon: Phone },
          ].map((f, i) => (
            <div key={i} className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="w-14 h-14 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red mb-6">
                <f.icon size={28} />
              </div>
              <h4 className="text-xl font-bold mb-2">{f.title}</h4>
              <p className="text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── MEMBERSHIP BANNER ────────────────────────────────────────── */}
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
