import React from 'react';
import { Menu, Search, Bell, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, TRANSLATIONS } from '../App';

interface HeaderProps {
  language: Language;
  setIsSidebarOpen: (open: boolean) => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ language, setIsSidebarOpen, activeTab }) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="bg-white border-b border-gray-100 px-8 py-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-daiichi-red transition-colors">
          <Menu size={24} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-daiichi-accent text-daiichi-red rounded-xl font-bold text-xs uppercase tracking-widest">
          <Globe size={16} />
          <span>{language === 'vi' ? 'Trực tuyến' : 'Online'}</span>
        </div>
        <button className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-daiichi-red hover:bg-red-50 transition-all relative">
          <Bell size={20} />
          <span className="absolute top-3 right-3 w-2 h-2 bg-daiichi-red rounded-full border-2 border-white" />
        </button>
      </div>
    </header>
  );
};
