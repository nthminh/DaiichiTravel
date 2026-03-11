import React from 'react';
import { 
  LayoutDashboard, Home, Bus, Package, Users, 
  MapPin, Truck, Star, LogOut, Menu, X, Globe, Settings as SettingsIcon,
  BarChart2
} from 'lucide-react';
import { motion } from 'motion/react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, setActiveTab, currentUser, onLogout, 
  language, setLanguage, isSidebarOpen, setIsSidebarOpen 
}) => {
  const t = TRANSLATIONS[language];

  const menuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: [UserRole.MANAGER] },
    { id: 'home', label: t.home, icon: Home, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER] },
    { id: 'book-ticket', label: t.book_ticket, icon: Bus, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER] },
    { id: 'tours', label: t.tours, icon: Star, roles: [UserRole.MANAGER, UserRole.AGENT, UserRole.CUSTOMER] },
    { id: 'consignments', label: t.consignments, icon: Package, roles: [UserRole.MANAGER, UserRole.AGENT] },
    { id: 'agents', label: t.agents, icon: Users, roles: [UserRole.MANAGER] },
    { id: 'routes', label: t.routes, icon: MapPin, roles: [UserRole.MANAGER] },
    { id: 'vehicles', label: t.vehicles, icon: Truck, roles: [UserRole.MANAGER] },
    { id: 'operations', label: t.operations, icon: Globe, roles: [UserRole.MANAGER] },
    { id: 'tour-management', label: language === 'vi' ? 'Quản lý Tour' : 'Tour Management', icon: Star, roles: [UserRole.MANAGER] },
    { id: 'stop-management', label: TRANSLATIONS[language].stop_management, icon: MapPin, roles: [UserRole.MANAGER] },
    { id: 'financial-report', label: TRANSLATIONS[language].financial_report || 'Financial Report', icon: BarChart2, roles: [UserRole.MANAGER] },
    { id: 'settings', label: t.settings, icon: SettingsIcon, roles: [UserRole.MANAGER, UserRole.AGENT] },
  ];

  const filteredMenu = menuItems.filter(item => 
    !currentUser || item.roles.includes(currentUser.role)
  );

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transition-transform duration-300 transform lg:relative lg:translate-x-0",
      isSidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-10">
          <img 
            src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724" 
            alt="Daiichi Logo" 
            className="h-10"
          />
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {filteredMenu.map((item) => (
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
