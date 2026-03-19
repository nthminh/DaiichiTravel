import React, { useState } from 'react';
import { 
  LayoutDashboard, Home, Bus, Package, Users, 
  MapPin, Truck, Star, LogOut, X, Globe, Settings as SettingsIcon,
  BarChart2, ChevronDown, CheckCircle, BookOpen, ChevronRight, CreditCard, Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, User, UserRole, TRANSLATIONS } from '../App';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  language: Language;
  setLanguage: (l: Language) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  permissions?: Record<string, Record<string, boolean>> | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, setActiveTab, currentUser, onLogout, 
  language, setLanguage, isSidebarOpen, setIsSidebarOpen, permissions
}) => {
  const t = TRANSLATIONS[language];
  const [isDaiichiOpen, setIsDaiichiOpen] = useState(false);

  // Admin-only pages grouped under the "Daiichi" dropdown
  const daiichiItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'operations', label: t.operations, icon: Globe },
    { id: 'routes', label: t.routes, icon: MapPin },
    { id: 'employees', label: TRANSLATIONS[language].employees || 'Nhân viên', icon: Users },
    { id: 'vehicles', label: t.vehicles, icon: Truck },
    { id: 'customers', label: TRANSLATIONS[language].customers || 'Khách hàng', icon: Users },
    { id: 'completed-trips', label: language === 'vi' ? 'Chuyến đã hoàn' : 'Completed Trips', icon: CheckCircle },
    { id: 'tour-management', label: language === 'vi' ? 'Quản lý Tour' : 'Tour Management', icon: Star },
    { id: 'pickup-dropoff', label: TRANSLATIONS[language].pickup_dropoff_management || 'Điểm đón/Trả', icon: MapPin },
    { id: 'stop-management', label: TRANSLATIONS[language].stop_management, icon: MapPin },
    { id: 'agents', label: t.agents, icon: Users },
    { id: 'payment-management', label: language === 'vi' ? 'Quản lý Thanh toán' : language === 'ja' ? '支払い管理' : 'Payment Mgmt', icon: CreditCard },
    { id: 'financial-report', label: TRANSLATIONS[language].financial_report || 'Financial Report', icon: BarChart2 },
  ];

  // Items visible to all applicable roles (non-admin-exclusive)
  const otherMenuItems = [
    { id: 'home', label: t.home, icon: Home, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER, UserRole.GUEST] },
    { id: 'book-ticket', label: t.book_ticket, icon: Bus, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER, UserRole.GUEST] },
    { id: 'my-tickets', label: t.my_tickets || 'Vé đã mua', icon: Ticket, roles: [UserRole.CUSTOMER, UserRole.GUEST] },
    { id: 'agent-bookings', label: t.agent_bookings || 'Vé của tôi', icon: Ticket, roles: [UserRole.AGENT] },
    { id: 'tours', label: t.tours, icon: Star, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER, UserRole.GUEST] },
    { id: 'consignments', label: t.consignments, icon: Package, roles: [UserRole.MANAGER, UserRole.AGENT] },
    { id: 'user-guide', label: t.user_guide ?? 'Hướng dẫn sử dụng', icon: BookOpen, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER, UserRole.GUEST, 'STAFF', 'DRIVER'] as UserRole[] },
    { id: 'settings', label: t.settings, icon: SettingsIcon, roles: [UserRole.MANAGER, UserRole.AGENT] },
  ];

  const role = currentUser?.role ?? '';
  const rolePerms = permissions?.[role];
  const isAdmin = currentUser?.role === UserRole.MANAGER;
  const isDaiichiActive = daiichiItems.some(item => item.id === activeTab);

  // For non-MANAGER: filter otherMenuItems using permissions (fallback to static role check)
  const filteredOtherMenu = otherMenuItems.filter(item => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.MANAGER) return true;
    if (rolePerms) return !!rolePerms[item.id];
    return item.roles.includes(currentUser.role as UserRole);
  });

  // For non-MANAGER: daiichi items accessible via permissions
  const permittedDaiichiItems = !isAdmin && rolePerms
    ? daiichiItems.filter(item => !!rolePerms[item.id])
    : [];

  const renderNavItem = (item: { id: string; label: any; icon: React.ComponentType<any> }, indent = false) => {
    const isActive = activeTab === item.id;
    return (
      <motion.button
        key={item.id}
        onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
        whileHover={{ x: 3 }}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl text-sm font-bold transition-all duration-200 group",
          indent ? "px-3 py-2.5" : "px-4 py-3",
          isActive
            ? "sidebar-active text-white"
            : "text-gray-500 hover:bg-red-50 hover:text-daiichi-red"
        )}
      >
        <item.icon size={indent ? 16 : 18} className={cn("transition-transform duration-200", !isActive && "group-hover:scale-110")} />
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight size={14} className="opacity-70" />}
      </motion.button>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100/80 transition-transform duration-300 transform lg:relative lg:translate-x-0 flex flex-col shadow-2xl shadow-gray-200/60",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Top header with logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
          <motion.img
            whileHover={{ scale: 1.04 }}
            src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724" 
            alt="Daiichi Logo" 
            className="h-10"
          />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto py-4 px-3">

          {/* Daiichi admin dropdown – only visible for MANAGER */}
          {isAdmin && (
            <div className="mb-3">
              <motion.button
                onClick={() => setIsDaiichiOpen(p => !p)}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                  isDaiichiActive
                    ? "sidebar-active text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-daiichi-red"
                )}
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard size={18} />
                  Daiichi Admin
                </span>
                <motion.span
                  animate={{ rotate: isDaiichiOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={15} />
                </motion.span>
              </motion.button>

              <AnimatePresence initial={false}>
                {isDaiichiOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-3 pl-3 border-l-2 border-daiichi-red/20 space-y-0.5 py-1">
                    {daiichiItems.map((item) =>
                        renderNavItem(item, true)
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Divider for admin */}
          {isAdmin && <div className="h-px bg-gray-100 mx-2 mb-3" />}

          {/* Permitted daiichi items for non-admin */}
          {permittedDaiichiItems.map((item) =>
            renderNavItem(item)
          )}

          {/* Other menu items */}
          <div className="space-y-0.5">
            {filteredOtherMenu.map((item) =>
              renderNavItem(item)
            )}
          </div>
        </div>

        {/* User profile + actions at bottom */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* User card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-daiichi-red/10 rounded-xl flex items-center justify-center text-daiichi-red font-extrabold text-sm border border-daiichi-red/20">
                {currentUser?.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{currentUser?.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{currentUser?.role}</p>
                {currentUser?.role === UserRole.AGENT && currentUser.address && (
                  <p className="text-[10px] text-gray-500 truncate">{currentUser.address}</p>
                )}
              </div>
            </div>
            {currentUser?.role === UserRole.AGENT && (
              <div className="mt-3 bg-white p-2.5 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">{t.balance}</p>
                <p className="text-sm font-bold text-daiichi-red">{currentUser.balance?.toLocaleString()}đ</p>
              </div>
            )}
          </div>

          {/* Language switcher */}
          <div className="flex gap-1.5">
            {['vi', 'en', 'ja'].map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang as any)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200",
                  language === lang ? "bg-daiichi-red text-white shadow-sm shadow-daiichi-red/30" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                )}
              >
                {lang === 'vi' ? '🇻🇳' : lang === 'en' ? '🇺🇸' : '🇯🇵'} {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Logout */}
          <motion.button 
            onClick={onLogout}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all duration-200"
          >
            <LogOut size={18} />
            {t.logout}
          </motion.button>
        </div>
      </div>
    </>
  );
};
