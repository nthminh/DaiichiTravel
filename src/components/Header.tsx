import React from 'react';
import { Menu, Bell, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, TRANSLATIONS } from '../App';

interface HeaderProps {
  language: Language;
  setIsSidebarOpen: (open: boolean) => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ language, setIsSidebarOpen, activeTab }) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100/80 px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden w-9 h-9 flex items-center justify-center text-gray-400 hover:text-daiichi-red hover:bg-red-50 rounded-xl transition-all"
        >
          <Menu size={22} />
        </motion.button>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Hotline pill */}
        <a
          href="tel:+84961004709"
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-daiichi-red/8 text-daiichi-red rounded-xl font-bold text-xs transition-all hover:bg-daiichi-red hover:text-white group"
        >
          <Phone size={14} className="group-hover:animate-pulse" />
          <span>096 100 47 09</span>
        </a>

        {/* Online status badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl font-bold text-xs border border-green-100">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>{language === 'vi' ? 'Trực tuyến' : 'Online'}</span>
        </div>

        {/* Notification bell */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="relative w-9 h-9 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl hover:text-daiichi-red hover:bg-red-50 transition-all"
        >
          <Bell size={18} />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 1 }}
            className="absolute top-1.5 right-1.5 w-2 h-2 bg-daiichi-red rounded-full border-2 border-white"
          />
        </motion.button>
      </div>
    </header>
  );
};
