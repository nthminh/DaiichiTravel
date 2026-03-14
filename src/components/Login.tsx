import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Bus, ArrowRight, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, User, UserRole } from '../App';

interface LoginProps {
  onLogin: (user: User) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  adminCredentials: any;
  agents: any[];
  employees?: any[];
  agentsLoading?: boolean;
}

// Particle configuration constants
const PARTICLE_COUNT = 18;
const PARTICLE_MIN_SIZE = 6;
const PARTICLE_SIZE_STEP = 5;
const PARTICLE_SIZE_VARIANTS = 5;
const PARTICLE_X_SPREAD = 95;
const PARTICLE_Y_SPREAD = 90;
const PARTICLE_MIN_DURATION = 3.5;
const PARTICLE_DURATION_STEP = 0.8;
const PARTICLE_MAX_DELAY = 4;

/** Small floating particle dot */
const Particle: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <span
    className="absolute rounded-full bg-white/20 pointer-events-none"
    style={style}
  />
);

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  width: `${PARTICLE_MIN_SIZE + (i % PARTICLE_SIZE_VARIANTS) * PARTICLE_SIZE_STEP}px`,
  height: `${PARTICLE_MIN_SIZE + (i % PARTICLE_SIZE_VARIANTS) * PARTICLE_SIZE_STEP}px`,
  left: `${(i * 17 + 5) % PARTICLE_X_SPREAD}%`,
  top: `${(i * 23 + 10) % PARTICLE_Y_SPREAD}%`,
  animationDelay: `${(i * 0.4) % PARTICLE_MAX_DELAY}s`,
  animationDuration: `${PARTICLE_MIN_DURATION + (i % PARTICLE_SIZE_VARIANTS) * PARTICLE_DURATION_STEP}s`,
}));

export const Login: React.FC<LoginProps> = ({ onLogin, language, setLanguage, adminCredentials, agents, employees, agentsLoading }) => {
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
      a.username && a.password != null &&
      String(a.username).trim().toLowerCase() === normalizedUsername &&
      String(a.password).trim() === trimmedPassword
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

    // Check Employees (drivers, staff, etc.)
    if (employees && employees.length > 0) {
      const employee = employees.find(emp =>
        emp.username && emp.password != null &&
        emp.status !== 'INACTIVE' &&
        String(emp.username).trim().toLowerCase() === normalizedUsername &&
        String(emp.password).trim() === trimmedPassword
      );
      if (employee) {
        onLogin({
          id: employee.id,
          username: employee.username,
          role: employee.role,
          name: employee.name,
        });
        return;
      }
    }

    setError(t.login_error);
  };

  const handleGuestLogin = () => {
    onLogin({ id: 'guest', username: 'guest', role: UserRole.CUSTOMER, name: 'Khách lẻ' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{ background: 'linear-gradient(145deg, #E31B23 0%, #8B0000 45%, #1a1a2e 100%)' }}
    >
      {/* Animated floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((p, i) => (
          <Particle key={i} style={{
            width: p.width, height: p.height,
            left: p.left, top: p.top,
            animation: `float-slow ${p.animationDuration} ease-in-out infinite`,
            animationDelay: p.animationDelay,
          }} />
        ))}
        {/* Large decorative blobs */}
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-white/[0.03]" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-daiichi-yellow/[0.07]" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '48px 48px' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand header + Language Switcher */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 18 }}
          className="flex items-center justify-between mb-8 gap-4"
        >
          <motion.div
            whileHover={{ scale: 1.04 }}
            className="bg-white rounded-3xl px-5 py-3 shadow-2xl shadow-black/40"
          >
            <img
              src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724"
              alt="Daiichi Logo"
              className="h-12 sm:h-14"
            />
          </motion.div>
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
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
                  language === lang.code ? "bg-white text-daiichi-red shadow-sm" : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-extrabold text-white drop-shadow-lg tracking-tight">{t.login_title}</h1>
          <p className="text-white/60 text-sm mt-1 font-medium">{t.login_subtitle}</p>
        </motion.div>

        {/* ── HERO CTA – Hand pointer pointing at "Book ticket" ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.18, type: 'spring', stiffness: 130, damping: 14 }}
          className="mb-5"
        >
          <motion.button
            onClick={handleGuestLogin}
            whileHover={{ scale: 1.025 }}
            whileTap={{ scale: 0.96 }}
            className="relative w-full overflow-hidden rounded-2xl cursor-pointer select-none focus:outline-none"
            style={{ background: 'linear-gradient(135deg, #E31B23 0%, #c0111a 100%)', boxShadow: '0 8px 32px rgba(227,27,35,0.5)' }}
          >
            {/* Shimmer sweep */}
            <span className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer pointer-events-none" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-2xl animate-pulse-ring pointer-events-none" />

            <div className="relative flex items-center gap-4 px-6 py-5">
              {/* Animated hand pointer emoji - pure CSS animation, no remounting */}
              <div className="relative flex-shrink-0">
                <span
                  className="text-4xl leading-none select-none animate-hand-bounce inline-block"
                  style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                >
                  👆
                </span>
              </div>

              <div className="flex-1 text-left">
                <p className="text-white font-extrabold text-base leading-tight tracking-wide">
                  {language === 'vi' ? 'Nhấn vào đây để đặt vé!' : language === 'ja' ? 'ここをクリックして予約！' : 'Tap here to book your ticket!'}
                </p>
                <p className="text-white/80 text-xs font-medium mt-0.5 flex items-center gap-1.5">
                  <Ticket size={12} />
                  {language === 'vi' ? 'Không cần đăng nhập · Nhanh chóng & Tiện lợi' : language === 'ja' ? 'ログイン不要 · 素早く & 便利' : 'No login required · Fast & Convenient'}
                </p>
              </div>

              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowRight size={18} className="text-white" />
              </div>
            </div>
          </motion.button>

          {/* Tiny label below */}
          <p className="text-center text-white/40 text-[10px] font-bold uppercase tracking-widest mt-2">
            {language === 'vi' ? '— Hoặc đăng nhập tài khoản bên dưới —'
              : language === 'ja' ? '— または以下でログイン —'
              : '— Or sign in with your account below —'}
          </p>
        </motion.div>

        {/* Login form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="glass-card p-7 rounded-3xl shadow-2xl"
        >
          {/* Staff/agent toggle header */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Bus size={14} className="text-white/80" />
            </div>
            <span className="text-white/80 text-xs font-bold uppercase tracking-widest">
              {language === 'vi' ? 'Đăng nhập hệ thống' : language === 'ja' ? 'システムログイン' : 'System Login'}
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.username}</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 transition-all duration-200"
                placeholder="admin / agent"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t.password}</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 transition-all duration-200"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2.5 text-sm font-medium border border-red-400/20"
                >
                  {error}
                </motion.p>
              )}
              {infoMessage && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-blue-200 bg-blue-900/30 rounded-xl px-4 py-2.5 text-sm font-medium border border-blue-400/20"
                >
                  {infoMessage}
                </motion.p>
              )}
            </AnimatePresence>

            {agentsLoading && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Loader2 size={14} className="animate-spin" />
                <span>{language === 'vi' ? 'Đang kết nối hệ thống...' : 'Connecting to system...'}</span>
              </div>
            )}

            <motion.button
              type="submit"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              className="btn-shimmer w-full bg-white text-daiichi-red py-3.5 rounded-xl font-extrabold shadow-lg hover:shadow-white/20 transition-all duration-200 text-sm tracking-wide"
            >
              {t.login_btn}
            </motion.button>
          </form>

          <div className="mt-5 pt-5 border-t border-white/10 text-center">
            <button
              onClick={handleGuestLogin}
              className="text-white/60 text-xs font-bold hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
            >
              <span>👤</span>
              <span>{t.guest_btn}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
