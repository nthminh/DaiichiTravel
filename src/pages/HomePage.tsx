import React from 'react';
import { Bus, Star, Phone, UserPlus } from 'lucide-react';
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

export function HomePage({ language, currentUser, agents, setActiveTab, setAgentTopUpModal }: HomePageProps) {
  const t = TRANSLATIONS[language];

  return (
    <div className="space-y-12">
      <div className="relative h-48 sm:h-72 md:h-[400px] rounded-[40px] overflow-hidden">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/hinhnenhome.png?alt=media&token=4be06677-5484-4225-a48f-2a7f92dc99f4"
          alt="Travel Hero"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center px-6 sm:px-12">
          <div className="max-w-xl text-white">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight"
            >
              {t.hero_title}
            </motion.h2>
            <p className="text-sm sm:text-base text-white/80 mb-4 sm:mb-8">{t.hero_subtitle}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTab('book-ticket')}
                className="px-4 py-2 sm:px-8 sm:py-4 bg-daiichi-red text-white rounded-2xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-105 transition-all text-sm sm:text-base"
              >
                {t.book_now}
              </button>
              <button
                onClick={() => setActiveTab('tours')}
                className="px-4 py-2 sm:px-8 sm:py-4 bg-white text-daiichi-red rounded-2xl font-bold hover:scale-105 transition-all text-sm sm:text-base"
              >
                {t.view_hot_tours}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent balance banner – shown when agent is logged in */}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

      {/* Membership invitation banner – shown only to unregistered guests */}
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
