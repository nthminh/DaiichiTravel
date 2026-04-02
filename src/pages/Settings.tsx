import React, { useState, useEffect } from 'react';
import { 
  Shield, User,
  Save, AlertCircle, CheckCircle2, Users, X, Check,
  CreditCard, Clock, ToggleLeft, ToggleRight, Phone, Plus, Trash2, Pencil
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, UserRole } from '../App';
import { transportService } from '../services/transportService';

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
  const [activeSection, setActiveSection] = useState<'PERSONAL' | 'AGENTS' | 'PERMISSIONS' | 'PAYMENT' | 'SECURITY'>(
    currentUser.role === UserRole.MANAGER ? 'PERSONAL' : 'PERSONAL'
  );
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const PAGE_LIST = [
    { id: 'home', label: language === 'vi' ? 'Trang chủ' : 'Home' },
    { id: 'book-ticket', label: language === 'vi' ? 'Đặt vé xe' : 'Book Ticket' },
    { id: 'my-tickets', label: language === 'vi' ? 'Vé đã mua' : 'My Tickets' },
    { id: 'agent-bookings', label: language === 'vi' ? 'Vé của tôi (Đại lý)' : 'My Bookings (Agent)' },
    { id: 'tours', label: language === 'vi' ? 'Tour' : 'Day Tours' },
    { id: 'consignments', label: language === 'vi' ? 'Gửi hàng' : 'Consignments' },
    { id: 'user-guide', label: language === 'vi' ? 'Hướng dẫn sử dụng' : 'User Guide' },
    { id: 'dashboard', label: 'Dashboard', adminOnly: true },
    { id: 'agents', label: language === 'vi' ? 'Đại lý' : 'Agents', adminOnly: true },
    { id: 'employees', label: language === 'vi' ? 'Nhân viên' : 'Employees', adminOnly: true },
    { id: 'routes', label: language === 'vi' ? 'Tuyến đường' : 'Routes', adminOnly: true },
    { id: 'vehicles', label: language === 'vi' ? 'Xe & Sơ đồ' : 'Vehicles', adminOnly: true },
    { id: 'operations', label: language === 'vi' ? 'Điều hành' : 'Operations', adminOnly: true },
    { id: 'customers', label: language === 'vi' ? 'Khách hàng' : 'Customers', adminOnly: true },
    { id: 'completed-trips', label: language === 'vi' ? 'Chuyến đã hoàn' : 'Completed Trips', adminOnly: true },
    { id: 'financial-report', label: language === 'vi' ? 'Báo cáo tài chính' : 'Financial Report', adminOnly: true },
    { id: 'settings', label: language === 'vi' ? 'Cài đặt' : 'Settings' },
  ];

  const ROLE_LIST = [
    { id: 'MANAGER', label: language === 'vi' ? 'Admin (Daiichi)' : 'Admin (Daiichi)', color: 'text-red-600 bg-red-50' },
    { id: 'SUPERVISOR', label: language === 'vi' ? 'Quản lý' : 'Supervisor', color: 'text-purple-600 bg-purple-50' },
    { id: 'AGENT', label: language === 'vi' ? 'Đại lý' : 'Agent', color: 'text-orange-600 bg-orange-50' },
    { id: 'STAFF', label: language === 'vi' ? 'Nhân viên' : 'Staff', color: 'text-blue-600 bg-blue-50' },
    { id: 'DRIVER', label: language === 'vi' ? 'Tài xế' : 'Driver', color: 'text-green-600 bg-green-50' },
    { id: 'CUSTOMER', label: language === 'vi' ? 'Thành viên' : 'Member', color: 'text-indigo-600 bg-indigo-50' },
    { id: 'GUEST', label: language === 'vi' ? 'Khách lẻ' : 'Guest', color: 'text-gray-600 bg-gray-100' },
  ];

  const defaultPerms: Record<string, Record<string, boolean>> = {
    MANAGER: Object.fromEntries(PAGE_LIST.map(p => [p.id, true])),
    SUPERVISOR: Object.fromEntries(PAGE_LIST.filter(p => p.id !== 'financial-report').map(p => [p.id, true])),
    AGENT: { 'home': true, 'book-ticket': true, 'agent-bookings': true, 'tours': true, 'consignments': true, 'user-guide': true, 'settings': true },
    STAFF: { 'home': true, 'book-ticket': true, 'consignments': true, 'user-guide': true },
    DRIVER: { 'home': true, 'user-guide': true },
    CUSTOMER: { 'home': true, 'book-ticket': true, 'my-tickets': true, 'tours': true, 'consignments': true, 'user-guide': true },
    GUEST: { 'home': true, 'book-ticket': true, 'my-tickets': true, 'tours': true, 'user-guide': true },
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

  // Subscribe to permissions from Firestore in real-time (overrides localStorage)
  useEffect(() => {
    const unsubscribe = transportService.subscribeToPermissions((cloudPerms) => {
      if (cloudPerms && typeof cloudPerms === 'object' && !Array.isArray(cloudPerms)) {
        setPermissions(cloudPerms);
        localStorage.setItem('daiichi_permissions', JSON.stringify(cloudPerms));
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

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

  const savePermissions = async () => {
    localStorage.setItem('daiichi_permissions', JSON.stringify(permissions));
    try {
      await transportService.savePermissions(permissions);
    } catch {/* silently ignore cloud save errors */}
    setSuccessMsg(language === 'vi' ? 'Đã lưu phân quyền' : 'Permissions saved');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Payment settings state
  const DEFAULT_PAYMENT_CONFIG = {
    holdTicketEnabled: true,
    holdTicketHours: 24,
    cashEnabled: true,
    bankTransferEnabled: true,
    momoEnabled: false,
    zalopayEnabled: false,
    vnpayEnabled: false,
    vietinbankEnabled: false,
    shbEnabled: false,
    bookingCutoffEnabled: true,
    bookingCutoffMinutes: 120,
    momoPartnerCode: '',
    zalopayAppId: '',
    vnpayTerminalId: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
    vietinbankClientId: '',
    vietinbankClientSecret: '',
    vietinbankMerchantId: '',
    vietinbankTerminalId: '',
    vietinbankAccountNumber: '',
    vietinbankAccountName: '',
    vietinbankEnvironment: 'sandbox' as 'sandbox' | 'production',
    shbClientId: '',
    shbClientSecret: '',
    shbMerchantId: '',
    shbTerminalId: '',
    shbAccountNumber: '',
    shbAccountName: '',
    shbEnvironment: 'sandbox' as 'sandbox' | 'production',
    // OnePay Vietnam
    onepayEnabled: false,
    onepayMerchant: '',
    onepayAccessCode: '',
    onepayHashKey: '',
    onepayReturnUrl: '',
    onepayIpnUrl: '',
    onepayEnvironment: 'sandbox' as 'sandbox' | 'production',
    onepayGatewayType: 'domestic' as 'domestic' | 'international',
  };
  const [paymentConfig, setPaymentConfig] = useState(DEFAULT_PAYMENT_CONFIG);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = transportService.subscribeToPaymentSettings((saved) => {
      if (saved && typeof saved === 'object') {
        // Safely merge only keys that exist in DEFAULT_PAYMENT_CONFIG
        const merged = { ...DEFAULT_PAYMENT_CONFIG };
        (Object.keys(DEFAULT_PAYMENT_CONFIG) as (keyof typeof DEFAULT_PAYMENT_CONFIG)[]).forEach(key => {
          if (key in saved && typeof (saved as Record<string, unknown>)[key] === typeof DEFAULT_PAYMENT_CONFIG[key]) {
            (merged as Record<string, unknown>)[key] = (saved as Record<string, unknown>)[key];
          }
        });
        setPaymentConfig(merged);
      }
      setPaymentConfigLoading(false);
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const savePaymentConfig = async () => {
    try {
      await transportService.savePaymentSettings(paymentConfig as unknown as Record<string, unknown>);
      setSuccessMsg(t.payment_settings_saved || 'Đã lưu cài đặt thanh toán');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg(language === 'vi' ? 'Lưu thất bại' : 'Save failed');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  // Security config state
  const DEFAULT_SECURITY_CONFIG = {
    phoneVerificationEnabled: false,
    phoneNumbers: [] as string[],
  };
  const [securityConfig, setSecurityConfig] = useState(DEFAULT_SECURITY_CONFIG);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [editPhoneIndex, setEditPhoneIndex] = useState<number | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState('');

  useEffect(() => {
    const unsubscribe = transportService.subscribeToSecurityConfig((saved) => {
      if (saved && typeof saved === 'object') {
        setSecurityConfig({
          phoneVerificationEnabled: typeof saved.phoneVerificationEnabled === 'boolean' ? saved.phoneVerificationEnabled : false,
          phoneNumbers: Array.isArray(saved.phoneNumbers) ? (saved.phoneNumbers as string[]) : [],
        });
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const addPhoneNumber = () => {
    const trimmed = newPhoneNumber.trim();
    if (!trimmed) return;
    // Normalize: convert leading 0 to +84 for Vietnamese numbers; other formats must already start with +
    const normalized = trimmed.startsWith('0') ? '+84' + trimmed.slice(1) : trimmed;
    // Validate E.164 format: starts with + followed by 7-15 digits
    if (!/^\+\d{7,15}$/.test(normalized)) {
      setErrorMsg(language === 'vi'
        ? 'Số điện thoại không hợp lệ. Dùng định dạng 0912345678 hoặc +84912345678'
        : 'Invalid phone number. Use 0912345678 or +84912345678 format');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }
    if (securityConfig.phoneNumbers.length >= 5) {
      setErrorMsg(language === 'vi' ? 'Tối đa 5 số điện thoại' : 'Maximum 5 phone numbers');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    if (securityConfig.phoneNumbers.includes(normalized)) {
      setErrorMsg(language === 'vi' ? 'Số điện thoại đã tồn tại' : 'Phone number already exists');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setSecurityConfig(prev => ({ ...prev, phoneNumbers: [...prev.phoneNumbers, normalized] }));
    setNewPhoneNumber('');
  };

  const removePhoneNumber = (index: number) => {
    setSecurityConfig(prev => ({ ...prev, phoneNumbers: prev.phoneNumbers.filter((_, i) => i !== index) }));
  };

  const startEditPhone = (index: number) => {
    setEditPhoneIndex(index);
    setEditPhoneValue(securityConfig.phoneNumbers[index]);
  };

  const cancelEditPhone = () => {
    setEditPhoneIndex(null);
    setEditPhoneValue('');
  };

  const saveEditPhone = () => {
    if (editPhoneIndex === null) return;
    const trimmed = editPhoneValue.trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('0') ? '+84' + trimmed.slice(1) : trimmed;
    if (!/^\+\d{7,15}$/.test(normalized)) {
      setErrorMsg(language === 'vi'
        ? 'Số điện thoại không hợp lệ. Dùng định dạng 0912345678 hoặc +84912345678'
        : 'Invalid phone number. Use 0912345678 or +84912345678 format');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }
    const others = securityConfig.phoneNumbers.filter((_, i) => i !== editPhoneIndex);
    if (others.includes(normalized)) {
      setErrorMsg(language === 'vi' ? 'Số điện thoại đã tồn tại' : 'Phone number already exists');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setSecurityConfig(prev => ({
      ...prev,
      phoneNumbers: prev.phoneNumbers.map((p, i) => (i === editPhoneIndex ? normalized : p)),
    }));
    setEditPhoneIndex(null);
    setEditPhoneValue('');
  };

  const saveSecurityConfig = async () => {
    try {
      await transportService.saveSecurityConfig(securityConfig as unknown as Record<string, unknown>);
      setSuccessMsg(language === 'vi' ? 'Đã lưu cài đặt bảo mật' : 'Security settings saved');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg(language === 'vi' ? 'Lưu thất bại' : 'Save failed');
      setTimeout(() => setErrorMsg(''), 3000);
    }
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
        {currentUser.role === UserRole.MANAGER && (
          <button 
            onClick={() => setActiveSection('PAYMENT')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeSection === 'PAYMENT' ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <CreditCard size={18} />
            {t.payment_settings || 'Cài đặt Thanh toán'}
          </button>
        )}
        {currentUser.role === UserRole.MANAGER && (
          <button 
            onClick={() => setActiveSection('SECURITY')}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeSection === 'SECURITY' ? "bg-daiichi-red text-white shadow-lg shadow-daiichi-red/20" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Phone size={18} />
            {language === 'vi' ? 'Bảo mật' : 'Security'}
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
        ) : activeSection === 'PERMISSIONS' ? (
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
                  <p className="text-sm text-gray-500">{language === 'vi' ? 'Chọn trang mỗi vai trò có thể xem. Thành viên (đã đăng nhập) và Khách lẻ (chưa đăng nhập) có thể được cấp quyền khác nhau.' : 'Select which pages each role can access. Members (logged in) and Guests (not logged in) can have different permissions.'}</p>
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
                            {page.adminOnly && <p className="text-[10px] text-gray-400">{language === 'vi' ? 'Mặc định chỉ Admin' : 'Admin only by default'}</p>}
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
        ) : activeSection === 'PAYMENT' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Hold Ticket Settings */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{t.hold_ticket_settings || 'Cài đặt Giữ vé'}</h3>
                  <p className="text-sm text-gray-500">{t.hold_ticket_note || 'Khách có thể đặt giữ chỗ trước, thanh toán sau'}</p>
                </div>
              </div>
              <div className="space-y-5 max-w-md">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-700">{t.hold_ticket_enabled || 'Cho phép giữ vé trước'}</p>
                    <p className="text-xs text-gray-400">{t.payment_hold || 'Giữ vé (chưa thanh toán)'}</p>
                  </div>
                  <button
                    onClick={() => setPaymentConfig(p => ({ ...p, holdTicketEnabled: !p.holdTicketEnabled }))}
                    className={cn("transition-colors", paymentConfig.holdTicketEnabled ? "text-green-500" : "text-gray-300")}
                  >
                    {paymentConfig.holdTicketEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </button>
                </div>
                {paymentConfig.holdTicketEnabled && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.hold_ticket_duration || 'Thời gian giữ vé mặc định (giờ)'}</label>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={paymentConfig.holdTicketHours}
                      onChange={e => setPaymentConfig(p => ({ ...p, holdTicketHours: parseInt(e.target.value) || 24 }))}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Booking Cutoff Settings */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{t.booking_cutoff_settings || 'Cài đặt Chặn đặt vé cận giờ'}</h3>
                  <p className="text-sm text-gray-500">{t.booking_cutoff_note || 'Khách và đại lý không thể chọn ghế khi xe sắp chạy'}</p>
                </div>
              </div>
              <div className="space-y-5 max-w-md">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-700">{t.booking_cutoff_enabled || 'Kích hoạt chặn đặt vé cận giờ'}</p>
                    <p className="text-xs text-gray-400">{t.booking_cutoff_note || 'Nhân viên và admin vẫn có thể đặt vé'}</p>
                  </div>
                  <button
                    onClick={() => setPaymentConfig(p => ({ ...p, bookingCutoffEnabled: !p.bookingCutoffEnabled }))}
                    className={cn("transition-colors", paymentConfig.bookingCutoffEnabled ? "text-green-500" : "text-gray-300")}
                  >
                    {paymentConfig.bookingCutoffEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </button>
                </div>
                {paymentConfig.bookingCutoffEnabled && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.booking_cutoff_minutes || 'Thời gian chặn trước khi xe chạy (phút)'}</label>
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={paymentConfig.bookingCutoffMinutes}
                      onChange={e => setPaymentConfig(p => ({ ...p, bookingCutoffMinutes: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Basic payment methods */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{t.payment_gateway_section || 'Cổng thanh toán'}</h3>
                  <p className="text-sm text-gray-500">{t.payment_gateway_note || 'Sẽ được kết nối sau khi ứng dụng hoàn thiện'}</p>
                </div>
              </div>

              <div className="space-y-4 max-w-2xl">
                {/* Cash */}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💵</span>
                    <div>
                      <p className="text-sm font-bold text-gray-700">{t.payment_cash_config || 'Tiền mặt'}</p>
                      <p className="text-xs text-green-600 font-bold">{t.payment_enabled || 'Kích hoạt'}</p>
                    </div>
                  </div>
                  <button onClick={() => setPaymentConfig(p => ({ ...p, cashEnabled: !p.cashEnabled }))} className={cn("transition-colors", paymentConfig.cashEnabled ? "text-green-500" : "text-gray-300")}>
                    {paymentConfig.cashEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>

                {/* Bank Transfer */}
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏦</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{t.payment_bank_transfer_config || 'Chuyển khoản ngân hàng'}</p>
                        <p className={cn("text-xs font-bold", paymentConfig.bankTransferEnabled ? "text-green-600" : "text-gray-400")}>{paymentConfig.bankTransferEnabled ? (t.payment_enabled || 'Kích hoạt') : (t.payment_disabled || 'Tắt')}</p>
                      </div>
                    </div>
                    <button onClick={() => setPaymentConfig(p => ({ ...p, bankTransferEnabled: !p.bankTransferEnabled }))} className={cn("transition-colors", paymentConfig.bankTransferEnabled ? "text-green-500" : "text-gray-300")}>
                      {paymentConfig.bankTransferEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                  {paymentConfig.bankTransferEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">{language === 'vi' ? 'Tên ngân hàng' : 'Bank Name'}</label><input type="text" value={paymentConfig.bankName} onChange={e => setPaymentConfig(p => ({ ...p, bankName: e.target.value }))} placeholder="VCB, BIDV, TCB..." className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">{language === 'vi' ? 'Số tài khoản' : 'Account Number'}</label><input type="text" value={paymentConfig.bankAccountNumber} onChange={e => setPaymentConfig(p => ({ ...p, bankAccountNumber: e.target.value }))} placeholder="0123456789" className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">{language === 'vi' ? 'Tên chủ tài khoản' : 'Account Name'}</label><input type="text" value={paymentConfig.bankAccountName} onChange={e => setPaymentConfig(p => ({ ...p, bankAccountName: e.target.value }))} placeholder={language === 'vi' ? 'Công ty Daiichi...' : 'Daiichi Travel...'} className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" /></div>
                    </div>
                  )}
                </div>

                {/* MoMo */}
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📱</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{t.payment_momo_config || 'MoMo'}</p>
                        <p className={cn("text-xs font-bold", paymentConfig.momoEnabled ? "text-green-600" : "text-gray-400")}>{paymentConfig.momoEnabled ? (t.payment_enabled || 'Kích hoạt') : (t.payment_disabled || 'Chưa kết nối')}</p>
                      </div>
                    </div>
                    <button onClick={() => setPaymentConfig(p => ({ ...p, momoEnabled: !p.momoEnabled }))} className={cn("transition-colors", paymentConfig.momoEnabled ? "text-pink-500" : "text-gray-300")}>
                      {paymentConfig.momoEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                  {paymentConfig.momoEnabled && (
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Partner Code</label>
                      <input type="text" value={paymentConfig.momoPartnerCode} onChange={e => setPaymentConfig(p => ({ ...p, momoPartnerCode: e.target.value }))} placeholder="MOMO_PARTNER_CODE" className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  )}
                </div>

                {/* ZaloPay */}
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💙</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{t.payment_zalopay_config || 'ZaloPay'}</p>
                        <p className={cn("text-xs font-bold", paymentConfig.zalopayEnabled ? "text-green-600" : "text-gray-400")}>{paymentConfig.zalopayEnabled ? (t.payment_enabled || 'Kích hoạt') : (t.payment_disabled || 'Chưa kết nối')}</p>
                      </div>
                    </div>
                    <button onClick={() => setPaymentConfig(p => ({ ...p, zalopayEnabled: !p.zalopayEnabled }))} className={cn("transition-colors", paymentConfig.zalopayEnabled ? "text-blue-500" : "text-gray-300")}>
                      {paymentConfig.zalopayEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                  {paymentConfig.zalopayEnabled && (
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">App ID</label>
                      <input type="text" value={paymentConfig.zalopayAppId} onChange={e => setPaymentConfig(p => ({ ...p, zalopayAppId: e.target.value }))} placeholder="ZALOPAY_APP_ID" className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  )}
                </div>

                {/* VNPay */}
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇻🇳</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{t.payment_vnpay_config || 'VNPay'}</p>
                        <p className={cn("text-xs font-bold", paymentConfig.vnpayEnabled ? "text-green-600" : "text-gray-400")}>{paymentConfig.vnpayEnabled ? (t.payment_enabled || 'Kích hoạt') : (t.payment_disabled || 'Chưa kết nối')}</p>
                      </div>
                    </div>
                    <button onClick={() => setPaymentConfig(p => ({ ...p, vnpayEnabled: !p.vnpayEnabled }))} className={cn("transition-colors", paymentConfig.vnpayEnabled ? "text-red-500" : "text-gray-300")}>
                      {paymentConfig.vnpayEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                  {paymentConfig.vnpayEnabled && (
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Terminal ID</label>
                      <input type="text" value={paymentConfig.vnpayTerminalId} onChange={e => setPaymentConfig(p => ({ ...p, vnpayTerminalId: e.target.value }))} placeholder="VNPAY_TERMINAL_ID" className="w-full mt-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/10" />
                    </div>
                  )}
                </div>

                {/* VietinBank */}
                <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏛️</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'VietinBank (Ngân hàng Thương mại cổ phần Công Thương Việt Nam)' : 'VietinBank OpenAPI'}</p>
                        <p className={cn("text-xs font-bold", paymentConfig.vietinbankEnabled ? "text-green-600" : "text-gray-400")}>
                          {paymentConfig.vietinbankEnabled ? (language === 'vi' ? 'Đã kích hoạt' : 'Enabled') : (language === 'vi' ? 'Chưa kết nối' : 'Not connected')}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setPaymentConfig(p => ({ ...p, vietinbankEnabled: !p.vietinbankEnabled }))} className={cn("transition-colors", paymentConfig.vietinbankEnabled ? "text-blue-600" : "text-gray-300")}>
                      {paymentConfig.vietinbankEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                  {paymentConfig.vietinbankEnabled && (
                    <div className="pt-3 border-t border-blue-100 space-y-3">
                      <p className="text-[11px] text-blue-600 font-semibold">{language === 'vi' ? 'Thông tin kết nối VietinBank OpenAPI' : 'VietinBank OpenAPI Connection Details'}</p>

                      {/* Environment */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Môi trường' : 'Environment'}</label>
                        <div className="flex gap-3 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="vietinbank_env"
                              value="sandbox"
                              checked={paymentConfig.vietinbankEnvironment === 'sandbox'}
                              onChange={() => setPaymentConfig(p => ({ ...p, vietinbankEnvironment: 'sandbox' }))}
                              className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-600 font-medium">Sandbox (Test)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="vietinbank_env"
                              value="production"
                              checked={paymentConfig.vietinbankEnvironment === 'production'}
                              onChange={() => setPaymentConfig(p => ({ ...p, vietinbankEnvironment: 'production' }))}
                              className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-600 font-medium">Production (Live)</span>
                          </label>
                        </div>
                      </div>

                      {/* API Credentials */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client ID</label>
                          <input
                            type="text"
                            value={paymentConfig.vietinbankClientId}
                            onChange={e => setPaymentConfig(p => ({ ...p, vietinbankClientId: e.target.value }))}
                            placeholder={language === 'vi' ? 'Client ID từ VietinBank' : 'Client ID from VietinBank'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client Secret</label>
                          <input
                            type="password"
                            value={paymentConfig.vietinbankClientSecret}
                            onChange={e => setPaymentConfig(p => ({ ...p, vietinbankClientSecret: e.target.value }))}
                            placeholder={language === 'vi' ? 'Client Secret từ VietinBank' : 'Client Secret from VietinBank'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Merchant ID</label>
                          <input
                            type="text"
                            value={paymentConfig.vietinbankMerchantId}
                            onChange={e => setPaymentConfig(p => ({ ...p, vietinbankMerchantId: e.target.value }))}
                            placeholder={language === 'vi' ? 'Mã merchant VietinBank' : 'VietinBank Merchant ID'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Terminal ID</label>
                          <input
                            type="text"
                            value={paymentConfig.vietinbankTerminalId}
                            onChange={e => setPaymentConfig(p => ({ ...p, vietinbankTerminalId: e.target.value }))}
                            placeholder={language === 'vi' ? 'Mã terminal VietinBank' : 'VietinBank Terminal ID'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                      </div>

                      {/* Bank account info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Số tài khoản VietinBank' : 'VietinBank Account Number'}</label>
                          <input
                            type="text"
                            value={paymentConfig.vietinbankAccountNumber}
                            onChange={e => setPaymentConfig(p => ({ ...p, vietinbankAccountNumber: e.target.value }))}
                            placeholder="108xxxxxxxxx"
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Tên chủ tài khoản' : 'Account Holder Name'}</label>
                          <input
                            type="text"
                            value={paymentConfig.vietinbankAccountName}
                            onChange={e => setPaymentConfig(p => ({ ...p, vietinbankAccountName: e.target.value }))}
                            placeholder={language === 'vi' ? 'Công ty TNHH Daiichi...' : 'Daiichi Travel Co., Ltd...'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-[11px] text-blue-700 font-semibold mb-1">{language === 'vi' ? '🔗 Endpoint API' : '🔗 API Endpoints'}</p>
                        <p className="text-[10px] text-blue-600 font-mono">
                          {paymentConfig.vietinbankEnvironment === 'sandbox'
                            ? 'https://sandbox.vietinbank.vn/openapi/...'
                            : 'https://openapi.vietinbank.vn/...'}
                        </p>
                        <p className="text-[10px] text-blue-500 mt-1">
                          {language === 'vi'
                            ? 'Thông tin xác thực được lưu trữ an toàn. Tích hợp OAuth2 sẽ sử dụng Client ID và Client Secret để lấy access token.'
                            : 'Credentials stored securely. OAuth2 integration will use Client ID & Client Secret to obtain access tokens.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* SHB */}
                <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏛️</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'SHB (Ngân hàng Thương mại cổ phần Sài Gòn - Hà Nội)' : 'SHB (Saigon-Hanoi Commercial Joint Stock Bank)'}</p>
                        <p className={cn("text-xs font-bold", paymentConfig.shbEnabled ? "text-green-600" : "text-gray-400")}>
                          {paymentConfig.shbEnabled ? (language === 'vi' ? 'Đã kích hoạt' : 'Enabled') : (language === 'vi' ? 'Chưa kết nối' : 'Not connected')}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setPaymentConfig(p => ({ ...p, shbEnabled: !p.shbEnabled }))} className={cn("transition-colors", paymentConfig.shbEnabled ? "text-blue-600" : "text-gray-300")}>
                      {paymentConfig.shbEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                  {paymentConfig.shbEnabled && (
                    <div className="pt-3 border-t border-blue-100 space-y-3">
                      <p className="text-[11px] text-blue-600 font-semibold">{language === 'vi' ? 'Thông tin kết nối SHB OpenAPI' : 'SHB OpenAPI Connection Details'}</p>

                      {/* Environment */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Môi trường' : 'Environment'}</label>
                        <div className="flex gap-3 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="shb_env"
                              value="sandbox"
                              checked={paymentConfig.shbEnvironment === 'sandbox'}
                              onChange={() => setPaymentConfig(p => ({ ...p, shbEnvironment: 'sandbox' }))}
                              className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-600 font-medium">Sandbox (Test)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="shb_env"
                              value="production"
                              checked={paymentConfig.shbEnvironment === 'production'}
                              onChange={() => setPaymentConfig(p => ({ ...p, shbEnvironment: 'production' }))}
                              className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-600 font-medium">Production (Live)</span>
                          </label>
                        </div>
                      </div>

                      {/* API Credentials */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client ID</label>
                          <input
                            type="text"
                            value={paymentConfig.shbClientId}
                            onChange={e => setPaymentConfig(p => ({ ...p, shbClientId: e.target.value }))}
                            placeholder={language === 'vi' ? 'Client ID từ SHB' : 'Client ID from SHB'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client Secret</label>
                          <input
                            type="password"
                            value={paymentConfig.shbClientSecret}
                            onChange={e => setPaymentConfig(p => ({ ...p, shbClientSecret: e.target.value }))}
                            placeholder={language === 'vi' ? 'Client Secret từ SHB' : 'Client Secret from SHB'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Merchant ID</label>
                          <input
                            type="text"
                            value={paymentConfig.shbMerchantId}
                            onChange={e => setPaymentConfig(p => ({ ...p, shbMerchantId: e.target.value }))}
                            placeholder={language === 'vi' ? 'Mã merchant SHB' : 'SHB Merchant ID'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Terminal ID</label>
                          <input
                            type="text"
                            value={paymentConfig.shbTerminalId}
                            onChange={e => setPaymentConfig(p => ({ ...p, shbTerminalId: e.target.value }))}
                            placeholder={language === 'vi' ? 'Mã terminal SHB' : 'SHB Terminal ID'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                      </div>

                      {/* Bank account info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Số tài khoản SHB' : 'SHB Account Number'}</label>
                          <input
                            type="text"
                            value={paymentConfig.shbAccountNumber}
                            onChange={e => setPaymentConfig(p => ({ ...p, shbAccountNumber: e.target.value }))}
                            placeholder="1000xxxxxxx"
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'vi' ? 'Tên chủ tài khoản' : 'Account Holder Name'}</label>
                          <input
                            type="text"
                            value={paymentConfig.shbAccountName}
                            onChange={e => setPaymentConfig(p => ({ ...p, shbAccountName: e.target.value }))}
                            placeholder={language === 'vi' ? 'Công ty TNHH Daiichi...' : 'Daiichi Travel Co., Ltd...'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-[11px] text-blue-700 font-semibold mb-1">{language === 'vi' ? '🔗 Endpoint API' : '🔗 API Endpoints'}</p>
                        <p className="text-[10px] text-blue-600 font-mono">
                          {paymentConfig.shbEnvironment === 'sandbox'
                            ? 'https://sandbox.shb.com.vn/openapi/...'
                            : 'https://openapi.shb.com.vn/...'}
                        </p>
                        <p className="text-[10px] text-blue-500 mt-1">
                          {language === 'vi'
                            ? 'Thông tin xác thực được lưu trữ an toàn. Tích hợp OAuth2 sẽ sử dụng Client ID và Client Secret để lấy access token.'
                            : 'Credentials stored securely. OAuth2 integration will use Client ID & Client Secret to obtain access tokens.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* OnePay Việt Nam */}
                <div className="p-4 rounded-2xl border border-orange-100 bg-orange-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💳</span>
                      <div>
                        <p className="text-sm font-bold text-gray-700">
                          {language === 'vi' ? 'OnePay Việt Nam' : 'OnePay Vietnam'}
                        </p>
                        <p className={cn("text-xs font-bold", paymentConfig.onepayEnabled ? "text-green-600" : "text-gray-400")}>
                          {paymentConfig.onepayEnabled
                            ? (language === 'vi' ? 'Đã kích hoạt' : 'Enabled')
                            : (language === 'vi' ? 'Chưa kết nối' : 'Not connected')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPaymentConfig(p => ({ ...p, onepayEnabled: !p.onepayEnabled }))}
                      className={cn("transition-colors", paymentConfig.onepayEnabled ? "text-orange-500" : "text-gray-300")}
                    >
                      {paymentConfig.onepayEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>

                  {paymentConfig.onepayEnabled && (
                    <div className="pt-3 border-t border-orange-100 space-y-3">
                      <p className="text-[11px] text-orange-600 font-semibold">
                        {language === 'vi' ? 'Thông tin kết nối cổng thanh toán OnePay' : 'OnePay Payment Gateway Connection Details'}
                      </p>

                      {/* Loại cổng thanh toán */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {language === 'vi' ? 'Loại cổng thanh toán' : 'Gateway Type'}
                        </label>
                        <div className="flex gap-3 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="onepay_gateway"
                              value="domestic"
                              checked={paymentConfig.onepayGatewayType === 'domestic'}
                              onChange={() => setPaymentConfig(p => ({ ...p, onepayGatewayType: 'domestic' }))}
                              className="accent-orange-500"
                            />
                            <span className="text-sm text-gray-600 font-medium">
                              {language === 'vi' ? 'Nội địa (ATM)' : 'Domestic (ATM)'}
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="onepay_gateway"
                              value="international"
                              checked={paymentConfig.onepayGatewayType === 'international'}
                              onChange={() => setPaymentConfig(p => ({ ...p, onepayGatewayType: 'international' }))}
                              className="accent-orange-500"
                            />
                            <span className="text-sm text-gray-600 font-medium">
                              {language === 'vi' ? 'Quốc tế (Visa/Master)' : 'International (Visa/Master)'}
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Môi trường */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {language === 'vi' ? 'Môi trường' : 'Environment'}
                        </label>
                        <div className="flex gap-3 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="onepay_env"
                              value="sandbox"
                              checked={paymentConfig.onepayEnvironment === 'sandbox'}
                              onChange={() => setPaymentConfig(p => ({ ...p, onepayEnvironment: 'sandbox' }))}
                              className="accent-orange-500"
                            />
                            <span className="text-sm text-gray-600 font-medium">Sandbox (Test)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="onepay_env"
                              value="production"
                              checked={paymentConfig.onepayEnvironment === 'production'}
                              onChange={() => setPaymentConfig(p => ({ ...p, onepayEnvironment: 'production' }))}
                              className="accent-orange-500"
                            />
                            <span className="text-sm text-gray-600 font-medium">Production (Live)</span>
                          </label>
                        </div>
                      </div>

                      {/* Thông tin xác thực OnePay */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {language === 'vi' ? 'Mã Merchant (vpc_Merchant)' : 'Merchant ID (vpc_Merchant)'}
                          </label>
                          <input
                            type="text"
                            value={paymentConfig.onepayMerchant}
                            onChange={e => setPaymentConfig(p => ({ ...p, onepayMerchant: e.target.value }))}
                            placeholder={language === 'vi' ? 'Mã merchant do OnePay cấp' : 'Merchant code from OnePay'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {language === 'vi' ? 'Mã Access Code (vpc_Access_Code)' : 'Access Code (vpc_Access_Code)'}
                          </label>
                          <input
                            type="text"
                            value={paymentConfig.onepayAccessCode}
                            onChange={e => setPaymentConfig(p => ({ ...p, onepayAccessCode: e.target.value }))}
                            placeholder={language === 'vi' ? 'Access Code do OnePay cấp' : 'Access Code from OnePay'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 font-mono"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {language === 'vi' ? 'Khóa bí mật HMAC-SHA256 (Hash Key — dạng hex)' : 'HMAC-SHA256 Hash Key (hex string)'}
                          </label>
                          <input
                            type="password"
                            value={paymentConfig.onepayHashKey}
                            onChange={e => setPaymentConfig(p => ({ ...p, onepayHashKey: e.target.value }))}
                            placeholder={language === 'vi' ? 'Hash Secret Key dạng hex do OnePay cấp' : 'Hex-encoded Hash Secret Key from OnePay'}
                            className="w-full mt-1 px-3 py-2 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 font-mono"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {language === 'vi' ? 'URL nhận kết quả (vpc_ReturnURL)' : 'Return URL (vpc_ReturnURL)'}
                          </label>
                          <input
                            type="text"
                            value={paymentConfig.onepayReturnUrl}
                            onChange={e => setPaymentConfig(p => ({ ...p, onepayReturnUrl: e.target.value }))}
                            placeholder="https://example.com/payment/return"
                            className="w-full mt-1 px-3 py-2 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {language === 'vi' ? 'IPN URL — Cloud Function onepayIpn (vpc_CallbackURL)' : 'IPN URL — onepayIpn Cloud Function (vpc_CallbackURL)'}
                          </label>
                          <input
                            type="text"
                            value={paymentConfig.onepayIpnUrl}
                            onChange={e => setPaymentConfig(p => ({ ...p, onepayIpnUrl: e.target.value }))}
                            placeholder="https://onepayipn-xxxxxxxx-as.a.run.app"
                            className="w-full mt-1 px-3 py-2 bg-white border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                          />
                          <p className="text-[10px] text-orange-500 mt-1">
                            {language === 'vi'
                              ? 'URL của Cloud Function onepayIpn (Firebase Console → Functions). Bắt buộc để OnePay gửi IPN về tự động.'
                              : 'onepayIpn Cloud Function URL (Firebase Console → Functions). Required for OnePay to deliver IPN automatically.'}
                          </p>
                        </div>
                      </div>

                      {/* Thông tin endpoint */}
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <p className="text-[11px] text-orange-700 font-semibold mb-1">
                          {language === 'vi' ? '🔗 Endpoint API OnePay' : '🔗 OnePay API Endpoint'}
                        </p>
                        <p className="text-[10px] text-orange-600 font-mono">
                          {paymentConfig.onepayGatewayType === 'domestic'
                            ? (paymentConfig.onepayEnvironment === 'sandbox'
                                ? 'https://mtf.onepay.vn/paygate/vpcpay.op'
                                : 'https://onepay.vn/paygate/vpcpay.op')
                            : (paymentConfig.onepayEnvironment === 'sandbox'
                                ? 'https://mtf.onepay.vn/onecomm-pay/vpc.op'
                                : 'https://onepay.vn/onecomm-pay/vpc.op')}
                        </p>
                        <p className="text-[10px] text-orange-500 mt-1">
                          {language === 'vi'
                            ? 'Thông tin xác thực được lưu trữ an toàn. Chữ ký HMAC-SHA256 được tính phía client khi tạo URL thanh toán.'
                            : 'Credentials stored securely. HMAC-SHA256 signature is computed client-side when generating the payment URL.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={savePaymentConfig} className="flex items-center gap-2 px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20">
                  <Save size={18} />
                  {language === 'vi' ? 'Lưu cài đặt' : 'Save Settings'}
                </button>
              </div>

              {successMsg && (
                <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold">{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                  <AlertCircle size={18} />
                  <span className="text-sm font-bold">{errorMsg}</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : activeSection === 'SECURITY' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-daiichi-accent rounded-2xl flex items-center justify-center text-daiichi-red">
                  <Phone size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{language === 'vi' ? 'Xác thực hai bước qua điện thoại' : 'Phone Two-Factor Verification'}</h3>
                  <p className="text-sm text-gray-500">{language === 'vi' ? 'Yêu cầu xác nhận OTP qua SMS khi admin đăng nhập' : 'Require OTP confirmation via SMS when admin logs in'}</p>
                </div>
              </div>

              <div className="space-y-6 max-w-lg">
                {/* Toggle */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-700">{language === 'vi' ? 'Bật xác thực điện thoại' : 'Enable phone verification'}</p>
                    <p className="text-xs text-gray-400">{language === 'vi' ? 'Khi bật, admin cần nhập mã OTP sau khi đăng nhập' : 'When enabled, admin must enter OTP after login'}</p>
                  </div>
                  <button
                    onClick={() => setSecurityConfig(prev => ({ ...prev, phoneVerificationEnabled: !prev.phoneVerificationEnabled }))}
                    className={cn("transition-colors", securityConfig.phoneVerificationEnabled ? "text-green-500" : "text-gray-300")}
                  >
                    {securityConfig.phoneVerificationEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </button>
                </div>

                {/* Phone numbers list */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {language === 'vi' ? `Số điện thoại nhận OTP (${securityConfig.phoneNumbers.length}/5)` : `Phone numbers for OTP (${securityConfig.phoneNumbers.length}/5)`}
                    </label>
                  </div>

                  <div className="space-y-2 mb-3">
                    {securityConfig.phoneNumbers.map((phone, idx) => (
                      <div key={idx}>
                        {editPhoneIndex === idx ? (
                          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-xl">
                            <Phone size={14} className="text-blue-400 flex-shrink-0" />
                            <input
                              type="tel"
                              value={editPhoneValue}
                              onChange={e => setEditPhoneValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEditPhone(); } if (e.key === 'Escape') cancelEditPhone(); }}
                              autoFocus
                              className="flex-1 px-2 py-1 bg-white border border-blue-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <button onClick={saveEditPhone} className="p-1 text-green-600 hover:text-green-700 transition-colors"><Check size={14} /></button>
                            <button onClick={cancelEditPhone} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                            <Phone size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="flex-1 text-sm font-mono text-gray-700">{phone}</span>
                            {idx === 0 && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                {language === 'vi' ? 'Chính' : 'Primary'}
                              </span>
                            )}
                            <button
                              onClick={() => startEditPhone(idx)}
                              className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                              title={language === 'vi' ? 'Sửa số điện thoại' : 'Edit phone number'}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => removePhoneNumber(idx)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {securityConfig.phoneNumbers.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-xl">
                        {language === 'vi' ? 'Chưa có số điện thoại nào' : 'No phone numbers added yet'}
                      </p>
                    )}
                  </div>

                  {securityConfig.phoneNumbers.length < 5 && (
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={newPhoneNumber}
                        onChange={e => setNewPhoneNumber(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhoneNumber())}
                        placeholder={language === 'vi' ? '0912345678 hoặc +84912345678' : '0912345678 or +84912345678'}
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daiichi-red/20"
                      />
                      <button
                        onClick={addPhoneNumber}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-daiichi-red text-white rounded-xl font-bold text-sm shadow-sm hover:scale-[1.02] transition-all"
                      >
                        <Plus size={16} />
                        {language === 'vi' ? 'Thêm' : 'Add'}
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-gray-400 mt-2">
                    {language === 'vi'
                      ? '* Số điện thoại đầu tiên trong danh sách sẽ là số nhận OTP mặc định khi đăng nhập. Sử dụng Firebase Authentication (10.000 SMS miễn phí/tháng).'
                      : '* The first phone number will receive the OTP by default on login. Uses Firebase Authentication (10,000 free SMS/month).'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={saveSecurityConfig} className="flex items-center gap-2 px-8 py-3 bg-daiichi-red text-white rounded-xl font-bold shadow-lg shadow-daiichi-red/20">
                  <Save size={18} />
                  {language === 'vi' ? 'Lưu cài đặt' : 'Save Settings'}
                </button>
              </div>

              {successMsg && (
                <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-bold">{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                  <AlertCircle size={18} />
                  <span className="text-sm font-bold">{errorMsg}</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
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
