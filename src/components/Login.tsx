import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, User, UserRole } from '../App';

interface LoginProps {
  onLogin: (user: User) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  adminCredentials: any;
  agents: any[];
  agentsLoading?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, language, setLanguage, adminCredentials, agents, agentsLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  const t = TRANSLATIONS[language];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage('');

    const normalizedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();
    
    // Check Admin
    if (normalizedUsername === adminCredentials.username.toLowerCase() && trimmedPassword === adminCredentials.password) {
      onLogin({ id: '1', username: adminCredentials.username, role: UserRole.MANAGER, name: 'Quản lý nhà xe' });
      return;
    }

    // Check Agents - wait if still loading
    if (agentsLoading) {
      setInfoMessage(language === 'vi' ? 'Đang tải dữ liệu, vui lòng thử lại...' : 'Loading data, please try again...');
      return;
    }

    const agent = agents.find(a =>
      a.username && a.password &&
      a.username.trim().toLowerCase() === normalizedUsername &&
      a.password.trim() === trimmedPassword
    );
    if (agent) {
      onLogin({ 
        id: agent.id, 
        username: agent.username!, 
        role: UserRole.AGENT, 
        name: agent.name, 
        address: agent.address,
        agentCode: agent.code, 
        balance: agent.balance 
      });
      return;
    }

    setError(t.login_error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 bg-gradient-to-br from-daiichi-red via-[#a01219] to-[#1a1a2e]">
      {/* Decorative background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute bottom-1/4 right-8 w-48 h-48 rounded-full bg-daiichi-yellow/10" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-white/5" />
      </div>

      {/* Language Switcher */}

      <div className="w-full max-w-md relative z-10">
        {/* Brand header with logo and language selector on same row */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 gap-4"
        >
          <div className="bg-white rounded-3xl px-5 py-3 shadow-2xl shadow-black/30">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724"
              alt="Daiichi Logo"
              className="h-12 sm:h-14"
            />
          </div>
          <div className="flex gap-1 bg-white/10 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20">
            {[
              { code: 'vi', label: 'VN', flag: '🇻🇳' },
              { code: 'en', label: 'EN', flag: '🇺🇸' },
              { code: 'ja', label: 'JA', flag: '🇯🇵' }
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  language === lang.code ? "bg-white text-daiichi-red shadow-sm" : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">{t.login_title}</h1>
          <p className="text-white/70 text-sm mt-1">{t.login_subtitle}</p>
        </div>

        {/* Impressive slogan banner – tap to enter as guest */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120 }}
          className="mb-6 cursor-pointer"
          onClick={() => onLogin({ id: 'guest', username: 'guest', role: UserRole.CUSTOMER, name: 'Khách lẻ' })}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative overflow-hidden bg-gradient-to-r from-daiichi-yellow/30 via-white/20 to-daiichi-yellow/30 backdrop-blur-md rounded-2xl border border-daiichi-yellow/50 px-5 py-4 shadow-lg shadow-daiichi-yellow/10 hover:border-daiichi-yellow/80 transition-colors">
            {/* Animated shimmer line */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear', repeatDelay: 1 }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-daiichi-yellow/30 border border-daiichi-yellow/50 flex items-center justify-center">
                <Zap size={18} className="text-daiichi-yellow" fill="currentColor" />
              </div>
              <div>
                <p className="text-daiichi-yellow font-extrabold text-sm tracking-wide uppercase leading-none mb-0.5">
                  {language === 'vi' ? 'Không cần đăng nhập!' : language === 'ja' ? 'ログイン不要！' : 'No Login Required!'}
                </p>
                <p className="text-white/90 text-xs font-medium">
                  {language === 'vi'
                    ? 'Đặt vé ngay tức thì – Nhanh chóng & Tiện lợi'
                    : language === 'ja'
                    ? '今すぐ予約 – 素早く & 便利'
                    : 'Book instantly – Fast & Convenient'}
                </p>
              </div>
              <div className="ml-auto flex-shrink-0">
                <CheckCircle2 size={22} className="text-green-300" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl"
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-white/70 uppercase">{t.username}</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
                placeholder="admin / agent"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-white/70 uppercase">{t.password}</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
                  placeholder="admin / agent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-sm font-medium">{error}</p>}
            {infoMessage && <p className="text-blue-200 bg-blue-900/30 rounded-xl px-4 py-2 text-sm font-medium">{infoMessage}</p>}
            {agentsLoading && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Loader2 size={14} className="animate-spin" />
                <span>{language === 'vi' ? 'Đang kết nối hệ thống...' : 'Connecting to system...'}</span>
              </div>
            )}
            <button type="submit" className="w-full bg-white text-daiichi-red py-4 rounded-xl font-bold shadow-lg hover:bg-gray-50 transition-all text-base">
              {t.login_btn}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <button
              onClick={() => onLogin({ id: 'guest', username: 'guest', role: UserRole.CUSTOMER, name: 'Khách lẻ' })}
              className="text-white/80 font-bold hover:text-white transition-colors"
            >
              {t.guest_btn}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
