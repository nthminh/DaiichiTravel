import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Bus, ArrowRight, Ticket, Phone, KeyRound, UserPlus, CheckCircle2, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TRANSLATIONS, Language, User, UserRole } from '../App';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CustomerCategory, CustomerProfile } from '../types';

type MemberLoginMethod = 'phone' | 'gmail' | 'facebook' | 'whatsapp' | 'email';
type MemberAuthStep = 'method' | 'phone-entry' | 'otp' | 'social-loading' | 'name-entry' | 'email-entry' | 'email-sent';

interface LoginProps {
  onLogin: (user: User) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  adminCredentials: any;
  agents: any[];
  employees?: any[];
  customers?: CustomerProfile[];
  agentsLoading?: boolean;
  securityConfig?: { phoneVerificationEnabled: boolean; phoneNumbers: string[] };
  onRegister?: (data: { name: string; phone: string; email?: string; username?: string; password: string }) => Promise<boolean>;
  onOtpMemberLogin?: (data: { name?: string; phone?: string; email?: string; uid?: string; loginMethod: string }) => Promise<User | null>;
  categories?: CustomerCategory[];
  onCategoryRequest?: (data: { customerId: string; categoryId: string; categoryName: string; proofFile: File }) => Promise<void>;
}

const RECAPTCHA_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '6Lc-vIosAAAAAPJ1NRFhFu43lldk12EAjgii-8Ke';

/** Loose email format check */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (import.meta.env.DEV && !import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  console.warn('[reCAPTCHA] VITE_RECAPTCHA_SITE_KEY is not set – falling back to the hardcoded site key. Set it in your .env file.');
}

/** Executes reCAPTCHA v3 and returns a token for OTP phone auth. */
const getRecaptchaToken = (): Promise<string> =>
  new Promise((resolve, reject) => {
    const g = (window as any).grecaptcha;
    if (!g || typeof g.ready !== 'function') {
      reject(new Error('reCAPTCHA not loaded'));
      return;
    }
    g.ready(async () => {
      try {
        if (typeof g.execute !== 'function') {
          reject(new Error('reCAPTCHA not loaded'));
          return;
        }
        // Call execute on the grecaptcha object to preserve the correct `this` binding.
        const token: string = await g.execute(RECAPTCHA_SITE_KEY, { action: 'LOGIN' });
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });


const PARTICLE_COUNT = 18;
const PARTICLE_MIN_SIZE = 6;
const PARTICLE_SIZE_STEP = 5;
const PARTICLE_SIZE_VARIANTS = 5;
const PARTICLE_X_SPREAD = 95;
const PARTICLE_Y_SPREAD = 90;
const PARTICLE_MIN_DURATION = 3.5;
const PARTICLE_DURATION_STEP = 0.8;
const PARTICLE_MAX_DELAY = 4;

/**
 * Normalise a phone number to E.164 format for OTP phone auth.
 * - Numbers starting with '0': treated as Vietnamese local format → +84...
 * - Numbers starting with '+': already E.164 (international or Vietnamese) → returned as-is
 * - International users MUST include their country code prefix (e.g. +61 for Australia).
 */
const toE164 = (phone: string): string => {
  const p = phone.trim();
  if (p.startsWith('0')) return '+84' + p.slice(1);
  if (p.startsWith('+')) return p;
  return '+84' + p;
};

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

export const Login: React.FC<LoginProps> = ({ onLogin, language, setLanguage, adminCredentials, agents, employees, customers, agentsLoading, securityConfig, onRegister, onOtpMemberLogin, categories, onCategoryRequest }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  // System login panel (admin/agent/staff) - hidden by default
  const [showSystemLogin, setShowSystemLogin] = useState(false);

  // Member login panel (customer accounts)
  const [showMemberLogin, setShowMemberLogin] = useState(false);
  const [memberUsername, setMemberUsername] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberLoginError, setMemberLoginError] = useState('');
  const [showMemberPassword, setShowMemberPassword] = useState(false);

  // Member registration panel
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regSaving, setRegSaving] = useState(false);
  const [regDone, setRegDone] = useState(false);
  const [regError, setRegError] = useState('');

  // OTP / phone verification state (for system login)
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [otpPhone, setOtpPhone] = useState('');

  // ── Member OTP login flow ──
  const [memberAuthStep, setMemberAuthStep] = useState<MemberAuthStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<MemberLoginMethod | null>(null);
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberOtp, setMemberOtp] = useState('');
  const [memberOtpLoading, setMemberOtpLoading] = useState(false);
  const [memberOtpError, setMemberOtpError] = useState('');
  const [memberNameInput, setMemberNameInput] = useState('');
  const [memberNameLoading, setMemberNameLoading] = useState(false);
  // Holds verified info from phone OTP or social OAuth before profile completion
  const [pendingAuthData, setPendingAuthData] = useState<{ uid?: string; phone?: string; email?: string; name?: string } | null>(null);


  /**
   * No-op: Supabase Auth tokens are handled automatically.
   * Previously used to ensure anonymous auth for Firestore writes.
   */
  const ensureFirebaseAuth = async (): Promise<void> => {
    // Not needed with Supabase – session management is automatic.
  };

  const t = TRANSLATIONS[language];

  /**
   * Helper: set an OTP-related error in both the OTP step panel and the login form
   * so the message is always visible regardless of which step is currently rendered.
   */
  const setOtpSendError = (msg: string) => {
    setOtpError(msg);
    // If we haven't transitioned to the OTP step yet the error panel is hidden,
    // so also surface the message on the login form via the shared `error` state.
    if (!otpStep) setError(msg);
  };

  const sendOtp = async (user: User, phoneNumber: string) => {
    setOtpLoading(true);
    setOtpError('');
    try {
      if (!isSupabaseConfigured || !supabase) {
        setOtpSendError(language === 'vi' ? 'Supabase chưa được cấu hình' : 'Supabase not configured');
        return false;
      }
      // Step 1: Execute reCAPTCHA v3 to obtain a verification token.
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = await getRecaptchaToken();
      } catch (captchaErr: any) {
        console.warn('[reCAPTCHA] token error (non-fatal):', captchaErr?.message);
      }

      // Step 2: Send OTP via Supabase Auth (phone OTP).
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
        options: recaptchaToken ? { captchaToken: recaptchaToken } : {},
      });
      if (error) throw error;
      setPendingUser(user);
      setOtpPhone(phoneNumber);
      setOtpStep(true);
      return true;
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      let errMsg: string;
      if (msg.includes('invalid') && msg.toLowerCase().includes('phone')) {
        errMsg = language === 'vi'
          ? 'Số điện thoại không hợp lệ. Vui lòng kiểm tra cài đặt bảo mật.'
          : 'Invalid phone number. Please check the security settings.';
      } else if (msg.includes('rate') || msg.includes('too many') || msg.includes('Too many')) {
        errMsg = language === 'vi'
          ? 'Quá nhiều yêu cầu, vui lòng thử lại sau vài phút'
          : 'Too many requests, please try again in a few minutes';
      } else {
        errMsg = language === 'vi' ? `Không thể gửi OTP: ${msg}` : `Cannot send OTP: ${msg}`;
      }
      setOtpSendError(errMsg);
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
      const { error } = await supabase.auth.verifyOtp({
        phone: otpPhone,
        token: otpCode.trim(),
        type: 'sms',
      });
      if (error) throw error;
      onLogin(pendingUser);
    } catch {
      setOtpError(language === 'vi' ? 'Mã OTP không đúng, vui lòng thử lại' : 'Incorrect OTP code, please try again');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingUser) return;
    await sendOtp(pendingUser, otpPhone);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMessage('');

    const normalizedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();
    
    // Check Admin
    if (normalizedUsername === adminCredentials.username.toLowerCase() && trimmedPassword === adminCredentials.password) {
      const user: User = { id: '1', username: adminCredentials.username, role: UserRole.MANAGER, name: 'Quản lý nhà xe' };
      // If phone verification is enabled and phone numbers are configured, send OTP
      if (securityConfig?.phoneVerificationEnabled && securityConfig.phoneNumbers.length > 0) {
        setError('');
        await sendOtp(user, securityConfig.phoneNumbers[0]);
        return;
      }
      await ensureFirebaseAuth();
      onLogin(user);
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
      await ensureFirebaseAuth();
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
        await ensureFirebaseAuth();
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

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberLoginError('');
    if (!customers || customers.length === 0) {
      setMemberLoginError(t.login_error);
      return;
    }
    const normalizedUsername = memberUsername.trim().toLowerCase();
    const trimmedPassword = memberPassword.trim();
    const customer = customers.find(c =>
      c.status !== 'INACTIVE' &&
      c.password != null &&
      (
        (c.username && String(c.username).trim().toLowerCase() === normalizedUsername) ||
        (c.phone && String(c.phone).trim().toLowerCase() === normalizedUsername)
      ) &&
      String(c.password).trim() === trimmedPassword
    );
    if (customer) {
      await ensureFirebaseAuth();
      onLogin({
        id: customer.id,
        username: customer.username || customer.phone,
        role: UserRole.CUSTOMER,
        name: customer.name,
        phone: customer.phone,
      });
      return;
    }
    setMemberLoginError(t.login_error);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRegister) return;
    if (!regName.trim() || !regPhone.trim() || !regPassword.trim()) return;
    setRegSaving(true);
    setRegError('');
    try {
      const ok = await onRegister({
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim() || undefined,
        username: regUsername.trim() || undefined,
        password: regPassword.trim(),
      });
      if (ok) {
        setRegDone(true);
      } else {
        setRegError(t.register_member_exists || 'Số điện thoại đã được đăng ký.');
      }
    } catch {
      setRegError(language === 'vi' ? 'Đăng ký thất bại. Vui lòng thử lại.' : 'Registration failed. Please try again.');
    } finally {
      setRegSaving(false);
    }
  };

  const handleGuestLogin = async () => {
    await ensureFirebaseAuth();
    onLogin({ id: 'guest', username: 'guest', role: UserRole.GUEST, name: 'Khách lẻ' });
  };

  // ─── Member OTP / social auth handlers ───────────────────────────────────

  /** Reset member OTP flow back to method selector */
  const resetMemberFlow = () => {
    setMemberAuthStep('method');
    setSelectedMethod(null);
    setMemberPhone('');
    setMemberEmail('');
    setMemberOtp('');
    setMemberOtpError('');
    setMemberNameInput('');
    setPendingAuthData(null);
  };

  /**
   * After OTP/OAuth sign-in succeeds, find or create the customer and log in.
   * If the customer is new and has no name yet, moves to the name-entry step.
   */
  const completeMemberLogin = async (authData: { uid?: string; phone?: string; email?: string; name?: string }, method: MemberLoginMethod) => {
    if (!onOtpMemberLogin) return;
    setPendingAuthData(authData);
    setMemberOtpLoading(true);
    const defaultName = language === 'vi' ? 'Khách hàng' : 'Customer';
    try {
      const user = await onOtpMemberLogin({ ...authData, loginMethod: method });
      if (user) {
        // New user with a default placeholder name → ask for real name before completing login
        if (!user.name || user.name === defaultName) {
          setMemberNameInput(authData.name || '');
          setMemberAuthStep('name-entry');
        } else {
          onLogin(user);
        }
      }
    } catch (err) {
      console.error('[completeMemberLogin]', err);
      setMemberOtpError(language === 'vi' ? 'Đăng nhập thất bại. Vui lòng thử lại.' : 'Login failed. Please try again.');
    } finally {
      setMemberOtpLoading(false);
    }
  };

  /** Send SMS OTP to the member's phone number */
  const handleMemberSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberPhone.trim()) return;
    setMemberOtpLoading(true);
    setMemberOtpError('');
    try {
      if (!isSupabaseConfigured || !supabase) {
        setMemberOtpError(language === 'vi' ? 'Supabase chưa được cấu hình' : 'Supabase not configured');
        return;
      }
      const phoneE164 = toE164(memberPhone);
      // Verify reCAPTCHA before sending OTP (best-effort)
      let captchaToken: string | undefined;
      try { captchaToken = await getRecaptchaToken(); } catch { /* non-fatal */ }
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneE164,
        options: captchaToken ? { captchaToken } : {},
      });
      if (error) throw error;
      setMemberAuthStep('otp');
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('invalid') && msg.toLowerCase().includes('phone')) {
        setMemberOtpError(language === 'vi' ? 'Số điện thoại không hợp lệ.' : 'Invalid phone number.');
      } else if (msg.includes('rate') || msg.includes('too many') || msg.includes('Too many')) {
        setMemberOtpError(language === 'vi' ? 'Quá nhiều yêu cầu, vui lòng thử lại sau.' : 'Too many requests, please try again later.');
      } else {
        setMemberOtpError(language === 'vi' ? `Không thể gửi OTP: ${msg}` : `Cannot send OTP: ${msg}`);
      }
    } finally {
      setMemberOtpLoading(false);
    }
  };

  /** Verify the 6-digit OTP entered by the member */
  const handleMemberOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (memberOtp.length !== 6) return;
    setMemberOtpLoading(true);
    setMemberOtpError('');
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
      const phoneE164 = toE164(memberPhone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: memberOtp.trim(),
        type: 'sms',
      });
      if (error) throw error;
      const sbUser = data.user;
      await completeMemberLogin(
        { uid: sbUser?.id, phone: sbUser?.phone || phoneE164, name: undefined },
        selectedMethod || 'phone',
      );
    } catch (err: any) {
      console.error('[OTP verify]', err);
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired')) {
        setMemberOtpError(t.otp_wrong || 'Mã OTP không đúng hoặc đã hết hạn, vui lòng thử lại');
      } else if (msg) {
        setMemberOtpError(language === 'vi' ? `Lỗi xác thực: ${msg}` : `Verification error: ${msg}`);
      } else {
        setMemberOtpError(t.otp_wrong || 'Mã OTP không đúng, vui lòng thử lại');
      }
    } finally {
      setMemberOtpLoading(false);
    }
  };

  /** Resend OTP to the same phone number */
  const handleMemberResendOtp = async () => {
    setMemberAuthStep('phone-entry');
    setMemberOtp('');
    setMemberOtpError('');
  };

  /** Sign in with Google OAuth */
  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setMemberAuthStep('social-loading');
    setMemberOtpError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
      // The page will redirect; onAuthStateChange in App.tsx will handle the callback.
    } catch (err: any) {
      setMemberOtpError(language === 'vi' ? 'Đăng nhập Google thất bại. Vui lòng thử lại.' : 'Google sign-in failed. Please try again.');
      setMemberAuthStep('method');
    }
  };

  /** Sign in with Facebook OAuth */
  const handleFacebookLogin = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setMemberAuthStep('social-loading');
    setMemberOtpError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    } catch (err: any) {
      setMemberOtpError(language === 'vi' ? 'Đăng nhập Facebook thất bại. Vui lòng thử lại.' : 'Facebook sign-in failed. Please try again.');
      setMemberAuthStep('method');
    }
  };

  /** Send a Supabase Email Sign-in OTP/Magic link (passwordless) */
  const handleEmailSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = memberEmail.trim();
    if (!email) return;
    if (!isSupabaseConfigured || !supabase) {
      setMemberOtpError(language === 'vi' ? 'Supabase chưa được cấu hình' : 'Supabase not configured');
      return;
    }
    // Basic email format check
    if (!EMAIL_REGEX.test(email)) {
      setMemberOtpError(t.otp_email_error_invalid || 'Địa chỉ email không hợp lệ.');
      return;
    }
    setMemberOtpLoading(true);
    setMemberOtpError('');
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl },
      });
      if (error) throw error;
      // Persist email so the completion handler can read it after redirect
      window.localStorage.setItem('emailForSignIn', email);
      setMemberAuthStep('email-sent');
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('invalid') && msg.toLowerCase().includes('email')) {
        setMemberOtpError(t.otp_email_error_invalid || 'Địa chỉ email không hợp lệ.');
      } else {
        setMemberOtpError(t.otp_email_error_failed || 'Không thể gửi email. Vui lòng thử lại.');
      }
    } finally {
      setMemberOtpLoading(false);
    }
  };

  /** Handle method selection */
  const handleMemberMethodSelect = (method: MemberLoginMethod) => {
    setSelectedMethod(method);
    setMemberOtpError('');
    if (method === 'phone' || method === 'whatsapp') {
      setMemberAuthStep('phone-entry');
    } else if (method === 'gmail') {
      handleGoogleLogin();
    } else if (method === 'facebook') {
      handleFacebookLogin();
    } else if (method === 'email') {
      setMemberAuthStep('email-entry');
    }
  };

  /** Complete profile: save name for new users */
  const handleMemberNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onOtpMemberLogin || !pendingAuthData || !selectedMethod) return;
    const name = memberNameInput.trim();
    if (!name) return;
    setMemberNameLoading(true);
    try {
      const user = await onOtpMemberLogin({ ...pendingAuthData, name, loginMethod: selectedMethod });
      if (user) {
        const userWithName = { ...user, name };
        onLogin(userWithName);
      }
    } catch {
      setMemberOtpError(language === 'vi' ? 'Không thể lưu thông tin. Vui lòng thử lại.' : 'Could not save profile. Please try again.');
    } finally {
      setMemberNameLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-x-hidden p-4"
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
              decoding="async"
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
            {language === 'vi' ? '— Hoặc đăng nhập / đăng ký thành viên bên dưới —'
              : language === 'ja' ? '— または会員登録・ログイン —'
              : '— Or sign in / register as a member below —'}
          </p>
        </motion.div>

        {/* ── Member section: OTP-based login / register ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="glass-card p-5 rounded-3xl shadow-2xl"
        >
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-bold text-sm flex items-center gap-2">
              <UserIcon size={15} className="text-white/70" />
              {t.member_login_btn || 'Đăng nhập / Đăng ký thành viên'}
            </p>
            {memberAuthStep !== 'method' && (
              <button
                onClick={resetMemberFlow}
                className="text-white/50 text-xs font-bold hover:text-white transition-colors"
              >
                {t.otp_back || '← Quay lại'}
              </button>
            )}
          </div>

          <AnimatePresence initial={false} mode="wait">
            {/* ── Step 1: Method selector ── */}
            {memberAuthStep === 'method' && (
              <motion.div
                key="method"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                <p className="text-white/60 text-xs text-center">
                  {t.otp_choose_method || 'Chọn phương thức đăng nhập / đăng ký'}
                </p>
                {memberOtpError && (
                  <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-xs font-medium border border-red-400/20">
                    {memberOtpError}
                  </p>
                )}
                <div className="flex flex-col gap-2.5">
                  {[
                    { id: 'phone' as const, label: t.otp_method_phone || 'Số ĐT Việt Nam', desc: t.otp_method_phone_desc || 'Nhận OTP qua SMS', emoji: '🇻🇳', disabled: false },
                    { id: 'gmail' as const, label: t.otp_method_gmail || 'Gmail', desc: t.otp_method_gmail_desc || 'Đăng nhập Google', emoji: '📧', disabled: false },
                    { id: 'facebook' as const, label: t.otp_method_facebook || 'Facebook', desc: language === 'vi' ? 'Tạm thời không khả dụng' : 'Temporarily unavailable', emoji: '📘', disabled: true },
                    { id: 'whatsapp' as const, label: t.otp_method_whatsapp || 'WhatsApp', desc: language === 'vi' ? 'Tạm thời không khả dụng' : 'Temporarily unavailable', emoji: '💬', disabled: true },
                    { id: 'email' as const, label: t.otp_method_email || 'Email', desc: t.otp_method_email_desc || 'Nhận link đăng nhập qua email', emoji: '✉️', disabled: false },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => !opt.disabled && handleMemberMethodSelect(opt.id)}
                      disabled={opt.disabled}
                      className={cn(
                        "flex flex-row items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left group w-full",
                        opt.disabled
                          ? "border-white/10 bg-white/[0.03] opacity-40 cursor-not-allowed"
                          : "border-white/20 bg-white/5 hover:bg-white/15 hover:border-white/40"
                      )}
                    >
                      <span className="text-2xl leading-none shrink-0">{opt.emoji}</span>
                      <span className="flex flex-col min-w-0">
                        <span className="text-white font-bold text-sm leading-tight">{opt.label}</span>
                        <span className="text-white/40 text-xs leading-tight group-hover:text-white/60 transition-colors">{opt.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Phone entry ── */}
            {memberAuthStep === 'phone-entry' && (
              <motion.div
                key="phone-entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                <form onSubmit={handleMemberSendOtp} className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{selectedMethod === 'whatsapp' ? '💬' : '📱'}</span>
                    <p className="text-white/80 text-xs font-bold">
                      {t.otp_enter_phone || 'Nhập số điện thoại của bạn'}
                    </p>
                  </div>
                  <input
                    type="tel"
                    value={memberPhone}
                    onChange={e => setMemberPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                    placeholder="+84 912 345 678"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm tracking-wide"
                    autoFocus
                    autoComplete="tel"
                    required
                  />
                  <p className="text-white/50 text-[11px] leading-tight">
                    {t.otp_phone_hint || 'Số VN: nhập dạng 0912... • Quốc tế: thêm mã quốc gia (vd: +61 cho Úc, +1 cho Mỹ)'}
                  </p>
                  {memberOtpError && (
                    <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-xs font-medium border border-red-400/20">
                      {memberOtpError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={memberOtpLoading || !memberPhone.trim()}
                    className="w-full py-3 bg-white text-daiichi-red rounded-xl font-extrabold text-sm shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {memberOtpLoading ? (
                      <><Loader2 size={16} className="animate-spin" />{t.otp_sending || 'Đang gửi...'}</>
                    ) : (
                      <><Phone size={15} />{t.otp_send_btn || 'Gửi mã OTP'}</>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step 3: OTP code entry ── */}
            {memberAuthStep === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                <form onSubmit={handleMemberOtpVerify} className="space-y-4">
                  <div>
                    <p className="text-white/70 text-xs font-medium mb-0.5">
                      {t.otp_sent_to || 'Mã OTP đã gửi đến'}&nbsp;
                      <span className="text-white font-bold">{memberPhone}</span>
                    </p>
                    <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                      {t.otp_enter_code || 'Nhập mã OTP'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={memberOtp}
                      onChange={e => setMemberOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full mt-1.5 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 transition-all text-center text-2xl tracking-[0.5em] font-mono"
                      placeholder="------"
                      autoFocus
                      autoComplete="one-time-code"
                    />
                  </div>
                  {memberOtpError && (
                    <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-xs font-medium border border-red-400/20">
                      {memberOtpError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={memberOtpLoading || memberOtp.length !== 6}
                    className="w-full py-3 bg-white text-daiichi-red rounded-xl font-extrabold text-sm shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {memberOtpLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={15} />}
                    {t.otp_confirm_btn || 'Xác nhận OTP'}
                  </button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleMemberResendOtp}
                      disabled={memberOtpLoading}
                      className="text-white/50 text-xs font-bold hover:text-white transition-colors disabled:opacity-40"
                    >
                      {t.otp_resend || 'Gửi lại OTP'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ── Step: Social auth loading ── */}
            {memberAuthStep === 'social-loading' && (
              <motion.div
                key="social-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <Loader2 size={28} className="animate-spin text-white/70" />
                <p className="text-white/70 text-sm font-medium">
                  {t.otp_social_loading || 'Đang kết nối...'}
                </p>
              </motion.div>
            )}

            {/* ── Step 4: Name entry for new users ── */}
            {memberAuthStep === 'name-entry' && (
              <motion.div
                key="name-entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                <form onSubmit={handleMemberNameSubmit} className="space-y-4">
                  <div className="flex flex-col items-center gap-2 mb-1">
                    <CheckCircle2 size={28} className="text-green-300" />
                    <p className="text-white font-bold text-sm text-center">
                      {t.otp_new_user_title || 'Xác minh thành công! 🎉'}
                    </p>
                    <p className="text-white/60 text-xs text-center">
                      {t.otp_new_user_desc || 'Bạn là thành viên mới. Vui lòng nhập tên để hoàn tất.'}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={memberNameInput}
                    onChange={e => setMemberNameInput(e.target.value)}
                    placeholder={t.otp_name_placeholder || 'Nhập họ và tên của bạn'}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
                    autoFocus
                    required
                  />
                  {memberOtpError && (
                    <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-xs font-medium border border-red-400/20">
                      {memberOtpError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={memberNameLoading || !memberNameInput.trim()}
                    className="w-full py-3 bg-white text-daiichi-red rounded-xl font-extrabold text-sm shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {memberNameLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={15} />}
                    {t.otp_complete_btn || 'Hoàn tất đăng ký'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step: Email entry ── */}
            {memberAuthStep === 'email-entry' && (
              <motion.div
                key="email-entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                <form onSubmit={handleEmailSendLink} className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">✉️</span>
                    <p className="text-white/80 text-xs font-bold">
                      {t.otp_enter_email || 'Nhập địa chỉ email của bạn'}
                    </p>
                  </div>
                  <input
                    type="email"
                    value={memberEmail}
                    onChange={e => setMemberEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
                    autoFocus
                    autoComplete="email"
                    required
                  />
                  {memberOtpError && (
                    <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-xs font-medium border border-red-400/20">
                      {memberOtpError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={memberOtpLoading || !memberEmail.trim()}
                    className="w-full py-3 bg-white text-daiichi-red rounded-xl font-extrabold text-sm shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {memberOtpLoading ? (
                      <><Loader2 size={16} className="animate-spin" />{t.otp_sending || 'Đang gửi...'}</>
                    ) : (
                      <>{t.otp_send_email_btn || 'Gửi link đăng nhập'}</>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step: Email sent confirmation ── */}
            {memberAuthStep === 'email-sent' && (
              <motion.div
                key="email-sent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="text-4xl">📧</span>
                  <p className="text-white font-bold text-sm">
                    {t.otp_email_sent_title || 'Kiểm tra email của bạn! 📧'}
                  </p>
                  <p className="text-white/60 text-xs">
                    {t.otp_email_sent_desc || 'Chúng tôi đã gửi link đăng nhập đến'}
                  </p>
                  <p className="text-white font-bold text-sm break-all">{memberEmail}</p>
                  <p className="text-white/50 text-[11px] leading-relaxed">
                    {t.otp_email_sent_note || 'Nhấp vào link trong email để hoàn tất đăng nhập. Link có hiệu lực trong 1 giờ.'}
                  </p>
                </div>
                {memberOtpError && (
                  <p className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2 text-xs font-medium border border-red-400/20">
                    {memberOtpError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setMemberAuthStep('email-entry')}
                  className="w-full py-2.5 border border-white/30 text-white/70 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                >
                  {t.otp_email_resend || 'Gửi lại email'}
                </button>
              </motion.div>
            )}

            {/* ── Step: Category claim removed ── */}
          </AnimatePresence>
        </motion.div>

        {/* ── System login toggle (hidden by default, for staff/admin) ── */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowSystemLogin(v => !v)}
            className="text-white/40 text-[11px] font-bold hover:text-white/70 transition-colors flex items-center gap-1.5 mx-auto"
          >
            <Bus size={13} />
            <span>
              {showSystemLogin
                ? (language === 'vi' ? 'Ẩn đăng nhập hệ thống' : language === 'ja' ? 'システムログインを隠す' : 'Hide system login')
                : (language === 'vi' ? 'Đăng nhập nhân viên / quản lý' : language === 'ja' ? 'スタッフ・管理者ログイン' : 'Staff / admin login')}
            </span>
          </button>
        </div>

        {/* ── System login card (collapsible) ── */}
        <AnimatePresence>
          {showSystemLogin && (
            <motion.div
              key="system-login"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="mt-3 glass-card p-7 rounded-3xl shadow-2xl"
            >
              {otpStep ? (
                /* ── OTP Verification Step ── */
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                      <Phone size={16} className="text-white/80" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        {language === 'vi' ? 'Xác thực điện thoại' : 'Phone Verification'}
                      </p>
                      <p className="text-white/60 text-xs">
                        {language === 'vi'
                          ? `Nhập mã OTP đã gửi đến ${otpPhone}`
                          : `Enter the OTP sent to ${otpPhone}`}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleOtpVerify} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                        {language === 'vi' ? 'Mã OTP' : 'OTP Code'}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full mt-1.5 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 transition-all duration-200 text-center text-2xl tracking-[0.5em] font-mono"
                        placeholder="------"
                        autoFocus
                        autoComplete="one-time-code"
                      />
                    </div>

                    <AnimatePresence>
                      {otpError && (
                        <motion.p
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-red-200 bg-red-900/30 rounded-xl px-4 py-2.5 text-sm font-medium border border-red-400/20"
                        >
                          {otpError}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="submit"
                      disabled={otpLoading || otpCode.length !== 6}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.97 }}
                      className="btn-shimmer w-full bg-white text-daiichi-red py-3.5 rounded-xl font-extrabold shadow-lg hover:shadow-white/20 transition-all duration-200 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {otpLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                      {language === 'vi' ? 'Xác nhận OTP' : 'Verify OTP'}
                    </motion.button>
                  </form>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <button
                      onClick={() => { setOtpStep(false); setOtpCode(''); setOtpError(''); setPendingUser(null); }}
                      className="text-white/60 text-xs font-bold hover:text-white transition-colors"
                    >
                      ← {language === 'vi' ? 'Quay lại' : 'Back'}
                    </button>
                    <button
                      onClick={handleResendOtp}
                      disabled={otpLoading}
                      className="text-white/60 text-xs font-bold hover:text-white transition-colors disabled:opacity-40"
                    >
                      {language === 'vi' ? 'Gửi lại OTP' : 'Resend OTP'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                    disabled={otpLoading}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-shimmer w-full bg-white text-daiichi-red py-3.5 rounded-xl font-extrabold shadow-lg hover:shadow-white/20 transition-all duration-200 text-sm tracking-wide flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {otpLoading && <Loader2 size={16} className="animate-spin" />}
                    {t.login_btn}
                  </motion.button>

                  <p className="text-white/40 text-[10px] text-center mt-3 leading-relaxed px-2">
                    {t.recaptcha_disclaimer}
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" aria-label="Google Privacy Policy" className="underline hover:text-white/60 transition-colors">{t.recaptcha_privacy}</a>
                    {t.recaptcha_and}
                    <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" aria-label="Google Terms of Service" className="underline hover:text-white/60 transition-colors">{t.recaptcha_terms}</a>
                    {t.recaptcha_of_google}
                  </p>
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
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Hidden container for reCAPTCHA invisible widget */}
      <div id="recaptcha-container" />
    </div>
  );
};
