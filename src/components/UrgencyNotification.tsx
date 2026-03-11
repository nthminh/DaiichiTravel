import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, TRANSLATIONS } from '../App';

export const UrgencyNotification = ({ language }: { language: Language }) => {
  const [show, setShow] = useState(false);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 right-8 z-50 max-w-sm"
        >
          <div className="bg-white p-6 rounded-3xl shadow-2xl border-2 border-daiichi-red flex gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-daiichi-red" />
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-daiichi-red shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">{t.urgency_title}</h4>
              <p className="text-sm text-gray-500 mt-1">{t.urgency_desc}</p>
              <button className="mt-4 text-xs font-bold text-daiichi-red uppercase tracking-widest hover:underline">
                {language === 'vi' ? 'Xem ngay' : 'View Now'}
              </button>
            </div>
            <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
