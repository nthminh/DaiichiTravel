import React, { useState } from 'react';
import { 
  LayoutDashboard, Home, Bus, Package, Users, 
  MapPin, Truck, Star, LogOut, Menu, X, Globe, Settings as SettingsIcon,
  BarChart2, ChevronDown, CheckCircle
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
    { id: 'agents', label: t.agents, icon: Users },
    { id: 'routes', label: t.routes, icon: MapPin },
    { id: 'vehicles', label: t.vehicles, icon: Truck },
    { id: 'operations', label: t.operations, icon: Globe },
    { id: 'completed-trips', label: language === 'vi' ? 'Chuyến đã hoàn' : 'Completed Trips', icon: CheckCircle },
    { id: 'tour-management', label: language === 'vi' ? 'Quản lý Tour' : 'Tour Management', icon: Star },
    { id: 'stop-management', label: TRANSLATIONS[language].stop_management, icon: MapPin },
    { id: 'financial-report', label: TRANSLATIONS[language].financial_report || 'Financial Report', icon: BarChart2 },
  ];

  // Items visible to all applicable roles (non-admin-exclusive)
  const otherMenuItems = [
    { id: 'home', label: t.home, icon: Home, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER] },
    { id: 'book-ticket', label: t.book_ticket, icon: Bus, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER] },
    { id: 'tours', label: t.tours, icon: Star, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER] },
    { id: 'consignments', label: t.consignments, icon: Package, roles: [UserRole.MANAGER, UserRole.AGENT] },
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
    return item.roles.includes(currentUser.role);
  });

  // For non-MANAGER: daiichi items accessible via permissions
  const permittedDaiichiItems = !isAdmin && rolePerms
    ? daiichiItems.filter(item => !!rolePerms[item.id])
    : [];

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transition-transform duration-300 transform lg:relative lg:translate-x-0",
      isSidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-6">
          <img 
            src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724" 
            alt="Daiichi Logo" 
            className="h-10"
          />
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Daiichi admin dropdown – only visible for MANAGER */}
        {isAdmin && (
          <div className="mb-4">
            <button
              onClick={() => setIsDaiichiOpen(p => !p)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                isDaiichiActive
                  ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20"
                  : "bg-daiichi-accent text-daiichi-red hover:bg-red-100"
              )}
            >
              <span className="flex items-center gap-3">
                <Menu size={18} />
                Daiichi
              </span>
              <ChevronDown
                size={16}
                className={cn("transition-transform duration-200", isDaiichiOpen ? "rotate-180" : "")}
              />
            </button>

            <AnimatePresence initial={false}>
              {isDaiichiOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-3 pl-3 border-l-2 border-daiichi-red/20 space-y-1">
                    {daiichiItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                          activeTab === item.id
                            ? "bg-daiichi-red text-white shadow-md shadow-daiichi-red/20"
                            : "text-gray-500 hover:bg-gray-50"
                        )}
                      >
                        <item.icon size={17} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {permittedDaiichiItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
                activeTab === item.id
                  ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20"
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
          {filteredOtherMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
                activeTab === item.id 
                  ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20" 
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-gray-100">
          <div className="bg-gray-50 p-4 rounded-2xl mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-daiichi-red font-bold border border-gray-100">
                {currentUser?.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{currentUser?.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{currentUser?.role}</p>
                {currentUser?.role === UserRole.AGENT && currentUser.address && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{currentUser.address}</p>
                )}
              </div>
            </div>
            {currentUser?.role === UserRole.AGENT && (
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t.balance}</p>
                <p className="text-sm font-bold text-daiichi-red">{currentUser.balance?.toLocaleString()}đ</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            {['vi', 'en', 'ja'].map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang as any)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                  language === lang ? "bg-daiichi-red text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                )}
              >
                {lang}
              </button>
            ))}
          </div>

          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            {t.logout}
          </button>
        </div>
      </div>
    </div>
  );
};
