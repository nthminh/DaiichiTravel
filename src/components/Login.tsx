import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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

  const t = TRANSLATIONS[language];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();
    
    // Check Admin
    if (normalizedUsername === adminCredentials.username.toLowerCase() && trimmedPassword === adminCredentials.password) {
      onLogin({ id: '1', username: adminCredentials.username, role: UserRole.MANAGER, name: 'Quản lý nhà xe' });
      return;
    }

    // Check Agents - wait if still loading
    if (agentsLoading) {
      setError(language === 'vi' ? 'Đang tải dữ liệu, vui lòng thử lại...' : 'Loading data, please try again...');
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
        agentCode: agent.code, 
        balance: agent.balance 
      });
      return;
    }

    setError(t.login_error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-daiichi-accent p-4 relative">
      {/* Language Switcher */}
      <div className="absolute top-8 right-8 flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
        {[
          { code: 'vi', label: 'VN', flag: '🇻🇳' },
          { code: 'en', label: 'EN', flag: '🇺🇸' },
          { code: 'ja', label: 'JA', flag: '🇯🇵' }
        ].map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code as any)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
              language === lang.code ? "bg-daiichi-red text-white" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <img 
            src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724" 
            alt="Daiichi Logo" 
            className="h-16 mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-800">{t.login_title}</h2>
          <p className="text-gray-500 text-sm">{t.login_subtitle}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t.username}</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" 
              placeholder="admin / agent"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">{t.password}</label>
            <div className="relative mt-1">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" 
                placeholder="admin / agent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          {agentsLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              <span>{language === 'vi' ? 'Đang kết nối hệ thống...' : 'Connecting to system...'}</span>
            </div>
          )}
          <button type="submit" className="w-full bg-daiichi-red text-white py-4 rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:bg-red-600 transition-all">
            {t.login_btn}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <button 
            onClick={() => onLogin({ id: 'guest', username: 'guest', role: UserRole.CUSTOMER, name: 'Khách lẻ' })}
            className="text-daiichi-red font-bold hover:underline"
          >
            {t.guest_btn}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
