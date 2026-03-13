import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, Shield, User, Key, 
  Save, AlertCircle, CheckCircle2, Users, X, Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, UserRole } from '../App';

interface SettingsProps {
  language: Language;
  currentUser: any;
  agents: any[];
  onUpdateAgent: (agentId: string, updates: any) => void;
  onUpdateAdmin: (updates: any) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  language, currentUser, agents, onUpdateAgent, onUpdateAdmin 
}) => {
  const t = TRANSLATIONS[language];
  const [activeSection, setActiveSection] = useState<'PERSONAL' | 'AGENTS' | 'PERMISSIONS'>(
    currentUser.role === UserRole.MANAGER ? 'PERSONAL' : 'PERSONAL'
  );
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const PAGE_LIST = [
    { id: 'home', label: language === 'vi' ? 'Trang chủ' : 'Home' },
    { id: 'book-ticket', label: language === 'vi' ? 'Đặt vé xe' : 'Book Ticket' },
    { id: 'tours', label: language === 'vi' ? 'Tour du lịch' : 'Tours' },
    { id: 'consignments', label: language === 'vi' ? 'Gửi hàng' : 'Consignments' },
    { id: 'dashboard', label: 'Dashboard', adminOnly: true },
    { id: 'agents', label: language === 'vi' ? 'Đại lý' : 'Agents', adminOnly: true },
    { id: 'routes', label: language === 'vi' ? 'Tuyến đường' : 'Routes', adminOnly: true },
    { id: 'vehicles', label: language === 'vi' ? 'Xe & Sơ đồ' : 'Vehicles', adminOnly: true },
    { id: 'operations', label: language === 'vi' ? 'Điều hành' : 'Operations', adminOnly: true },
    { id: 'completed-trips', label: language === 'vi' ? 'Chuyến đã hoàn' : 'Completed Trips', adminOnly: true },
    { id: 'financial-report', label: language === 'vi' ? 'Báo cáo tài chính' : 'Financial Report', adminOnly: true },
    { id: 'settings', label: language === 'vi' ? 'Cài đặt' : 'Settings' },
  ];

  const ROLE_LIST = [
    { id: 'MANAGER', label: language === 'vi' ? 'Admin (Daiichi)' : 'Admin (Daiichi)', color: 'text-red-600 bg-red-50' },
    { id: 'AGENT', label: language === 'vi' ? 'Đại lý' : 'Agent', color: 'text-orange-600 bg-orange-50' },
    { id: 'STAFF', label: language === 'vi' ? 'Nhân viên' : 'Staff', color: 'text-blue-600 bg-blue-50' },
    { id: 'DRIVER', label: language === 'vi' ? 'Tài xế' : 'Driver', color: 'text-green-600 bg-green-50' },
    { id: 'CUSTOMER', label: language === 'vi' ? 'Khách lẻ' : 'Customer', color: 'text-gray-600 bg-gray-100' },
  ];

  const defaultPerms: Record<string, Record<string, boolean>> = {
    MANAGER: Object.fromEntries(PAGE_LIST.map(p => [p.id, true])),
    AGENT: { 'home': true, 'book-ticket': true, 'tours': true, 'consignments': true, 'settings': true },
    STAFF: { 'home': true, 'book-ticket': true, 'consignments': true },
    DRIVER: { 'home': true },
    CUSTOMER: { 'home': true, 'book-ticket': true, 'tours': true },
  };

  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const saved = localStorage.getItem('daiichi_permissions');
      if (!saved) return defaultPerms;
      const parsed = JSON.parse(saved);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return defaultPerms;
      return parsed as Record<string, Record<string, boolean>>;
    } catch { return defaultPerms; }
  });

  const togglePerm = (roleId: string, pageId: string) => {
    if (roleId === 'MANAGER') return;
    setPermissions(prev => {
      const updated = {
        ...prev,
        [roleId]: { ...(prev[roleId] || {}), [pageId]: !(prev[roleId]?.[pageId] ?? false) }
      };
      localStorage.setItem('daiichi_permissions', JSON.stringify(updated));
      return updated;
    });
  };

  const savePermissions = () => {
    localStorage.setItem('daiichi_permissions', JSON.stringify(permissions));
    setSuccessMsg(language === 'vi' ? 'Đã lưu phân quyền' : 'Permissions saved');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Form states for personal password change
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handlePersonalUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass && newPass !== confirmPass) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu xác nhận không khớp' : 'Passwords do not match');
      return;
    }
    const updates: { username?: string; password?: string } = {};
    if (newUsername && newUsername !== currentUser.username) updates.username = newUsername;
    if (newPass) updates.password = newPass;
    if (Object.keys(updates).length === 0) {
      setErrorMsg(language === 'vi' ? 'Không có thay đổi nào' : 'No changes made');
      return;
    }
    onUpdateAdmin(updates);
    setSuccessMsg(language === 'vi' ? 'Cập nhật thành công' : 'Update successful');
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
    setTimeout(() => setSuccessMsg(''), 3000);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">{t.settings}</h2>
        <p className="text-gray-500">{t.account_settings}</p>
      </div>

      <div className="flex gap-4 border-b border-gray-100 pb-4">
        <button 
          onClick={() => setActiveSection('PERSONAL')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all",
            activeSection === 'PERSONAL' ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20" : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <User size={18} />
          {language === 'vi' ? 'Cá nhân' : 'Personal'}
        </button>
        {currentUser.role === UserRole.MANAGER && (
          <button 
            onClick={() => setActiveSection('AGENTS')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeSection === 'AGENTS' ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Users size={18} />
            {t.agent_credentials}
          </button>
        )}
        {currentUser.role === UserRole.MANAGER && (
          <button 
            onClick={() => setActiveSection('PERMISSIONS')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeSection === 'PERMISSIONS' ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Shield size={18} />
            {language === 'vi' ? 'Phân quyền' : 'Permissions'}
          </button>
        )}
      </div>

      <div className="max-w-4xl">
        {activeSection === 'PERSONAL' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">{t.manage_credentials}</h3>
            </div>

            <form onSubmit={handlePersonalUpdate} className="space-y-6 max-w-md">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.username}</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">{t.current_password}</label>
                <input 
                  type="password" 
                  value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.new_password}</label>
                  <input 
                    type="password" 
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.confirm_password}</label>
                  <input 
                    type="password" 
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20" 
                  />
                </div>
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold">{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                  <AlertCircle size={18} />
                  <span className="text-sm font-bold">{errorMsg}</span>
                </div>
              )}

              <button type="submit" className="flex items-center justify-center gap-2 w-full py-4 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20 hover:scale-[1.02] transition-all">
                <Save size={20} />
                {language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}
              </button>
            </form>
          </motion.div>
        ) : activeSection === 'AGENTS' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {agents.map((agent) => (
              <AgentCredentialCard 
                key={agent.id} 
                agent={agent} 
                language={language} 
                onUpdate={(updates) => onUpdateAgent(agent.id, updates)}
                t={t}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{language === 'vi' ? 'Phân quyền truy cập' : 'Access Permissions'}</h3>
                  <p className="text-sm text-gray-500">{language === 'vi' ? 'Chọn trang mỗi vai trò có thể xem' : 'Select which pages each role can access'}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Trang' : 'Page'}</th>
                      {ROLE_LIST.map(role => (
                        <th key={role.id} className="pb-4 text-center">
                          <span className={cn("px-3 py-1 rounded-full text-xs font-bold", role.color)}>{role.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {PAGE_LIST.map(page => (
                      <tr key={page.id} className="hover:bg-gray-50/50">
                        <td className="py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{page.label}</p>
                            {page.adminOnly && <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Mặc định chỉ Admin' : 'Admin default — can grant to others'}</p>}
                          </div>
                        </td>
                        {ROLE_LIST.map(role => (
                          <td key={role.id} className="py-3 text-center">
                            {role.id === 'MANAGER' ? (
                              <span className="text-green-500">✓</span>
                            ) : (
                              <button
                                onClick={() => togglePerm(role.id, page.id)}
                                className={cn(
                                  "w-6 h-6 rounded-md border-2 flex items-center justify-center mx-auto transition-all",
                                  permissions[role.id]?.[page.id]
                                    ? "bg-daiichi-red border-daiichi-red text-white"
                                    : "border-gray-200 text-gray-200 hover:border-gray-300"
                                )}
                              >
                                {permissions[role.id]?.[page.id] && <Check size={14} />}
                              </button>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={savePermissions} className="flex items-center gap-2 px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20">
                  <Save size={18} />
                  {language === 'vi' ? 'Lưu phân quyền' : 'Save Permissions'}
                </button>
              </div>

              {successMsg && (
                <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold">{successMsg}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const AgentCredentialCard = ({ agent, language, onUpdate, t }: { agent: any, language: Language, onUpdate: (u: any) => void, t: any, key?: any }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(agent.username);
  const [password, setPassword] = useState(agent.password);

  const handleSave = () => {
    onUpdate({ username, password });
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
          <User size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-800">{agent.name}</h4>
          <p className="text-xs text-gray-400 font-mono">{agent.code}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.username}</label>
          <input 
            type="text" 
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={!isEditing}
            className={cn(
              "w-full mt-1 px-4 py-2 rounded-xl text-sm transition-all",
              isEditing ? "bg-white border border-gray-200 focus:ring-2 focus:ring-daiichi-red/10" : "bg-gray-50 border border-transparent text-gray-500"
            )}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.password}</label>
          <input 
            type={isEditing ? "text" : "password"} 
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={!isEditing}
            className={cn(
              "w-full mt-1 px-4 py-2 rounded-xl text-sm transition-all",
              isEditing ? "bg-white border border-gray-200 focus:ring-2 focus:ring-daiichi-red/10" : "bg-gray-50 border border-transparent text-gray-500"
            )}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} className="p-3 text-gray-400 hover:bg-gray-50 rounded-xl transition-all">
              <X size={20} />
            </button>
            <button onClick={handleSave} className="p-3 bg-daiichi-red text-white rounded-xl shadow-lg shadow-daiichi-red/20 transition-all">
              <Save size={20} />
            </button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} className="px-6 py-2 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-all">
            {t.edit}
          </button>
        )}
      </div>
    </div>
  );
};
