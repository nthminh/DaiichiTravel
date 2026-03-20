import { UserRole } from '../constants/translations';
import { CustomerProfile } from '../types';
import { transportService } from '../services/transportService';
import type { Language } from '../constants/translations';

interface UseAuthOptions {
  language: Language;
  customers: CustomerProfile[];
}

/**
 * Provides member authentication helpers:
 * - handleRegisterMember: register a new customer (phone/password flow)
 * - handleOtpMemberLogin: find-or-create customer after Firebase OTP/OAuth sign-in
 */
export function useAuth({ language, customers }: UseAuthOptions) {
  const handleRegisterMember = async (data: {
    name: string;
    phone: string;
    email?: string;
    username?: string;
    password: string;
  }): Promise<boolean> => {
    // Check if phone already registered
    const exists = customers.some(c => c.phone === data.phone);
    if (exists) return false;
    // Normalize phone for default username: strip leading + and country code prefix if needed
    const normalizedPhone = data.phone.replace(/^\+84/, '0').replace(/[^0-9]/g, '');
    // Store username in lowercase so login is case-insensitive
    const storedUsername = (data.username || normalizedPhone || data.phone).toLowerCase();
    await transportService.addCustomer({
      name: data.name || (language === 'vi' ? 'Khách hàng' : 'Customer'),
      phone: data.phone,
      email: data.email,
      username: storedUsername,
      password: data.password,
      status: 'ACTIVE',
      registeredAt: new Date().toISOString(),
      totalBookings: 1,
    });
    return true;
  };

  /**
   * OTP / OAuth-based member login and auto-registration.
   * Called after Firebase phone-OTP or social sign-in succeeds.
   * Finds an existing customer by phone / email / firebaseUid or creates a new one.
   */
  const handleOtpMemberLogin = async (data: {
    name?: string;
    phone?: string;
    email?: string;
    uid?: string;
    loginMethod: string;
  }): Promise<{ id: string; username: string; role: UserRole; name: string; phone?: string; email?: string } | null> => {
    // Normalise phone for storage/lookup:
    // - Vietnamese E.164 (+84xxx) → local 0xxx format (consistent with traditional registration)
    // - International E.164 (+CCxxx) → kept as-is (e.g. +61412345678 for Australia)
    // - Already local (0xxx): no change
    const normalizedPhone = data.phone
      ? data.phone.replace(/^\+84/, '0')
      : undefined;

    // For phone-auth users who have no email, derive a default email from the
    // phone number so that email-dependent features (e.g. OTP confirmation,
    // welcome emails) are never blocked by an empty email field.
    const phoneDigits = (normalizedPhone || data.phone || '').replace(/[^0-9]/g, '');
    const effectiveEmail = data.email || (phoneDigits ? `${phoneDigits}@gmail.com` : undefined);

    const defaultName = language === 'vi' ? 'Khách hàng' : 'Customer';

    // 1. Find existing customer by uid, phone, or email
    // Compare phone digits only to handle format variations (+61..., 61..., 0...).
    let customer = customers.find(c => {
      if (data.uid && c.firebaseUid === data.uid) return true;
      if (normalizedPhone && c.phone) {
        const normDigits = normalizedPhone.replace(/[^0-9]/g, '');
        const cDigits = c.phone.replace(/[^0-9]/g, '');
        if (normDigits && normDigits === cDigits) return true;
      }
      if (data.phone && c.phone === data.phone) return true;
      if (data.email && c.email && c.email.toLowerCase() === data.email.toLowerCase()) return true;
      return false;
    });

    if (customer) {
      // Update profile fields that may have changed
      const updates: Partial<Omit<CustomerProfile, 'id'>> = {
        loginMethod: data.loginMethod as CustomerProfile['loginMethod'],
      };
      if (data.uid && !customer.firebaseUid) updates.firebaseUid = data.uid;
      if (data.name && data.name !== customer.name) updates.name = data.name;
      if (effectiveEmail && !customer.email) updates.email = effectiveEmail;
      if (normalizedPhone && !customer.phone) updates.phone = normalizedPhone;
      await transportService.updateCustomer(customer.id, updates);

      return {
        id: customer.id,
        username: customer.username || customer.phone || effectiveEmail || 'member',
        role: UserRole.CUSTOMER,
        name: customer.name || data.name || defaultName,
        phone: customer.phone || normalizedPhone,
        email: customer.email || effectiveEmail,
      };
    }

    // 2. Create new customer profile
    const newCustomer: Omit<CustomerProfile, 'id'> = {
      name: data.name || defaultName,
      phone: normalizedPhone || data.phone || '',
      username: normalizedPhone || effectiveEmail || data.uid || '',
      loginMethod: data.loginMethod as CustomerProfile['loginMethod'],
      status: 'ACTIVE',
      registeredAt: new Date().toISOString(),
      totalBookings: 0,
    };
    if (effectiveEmail) newCustomer.email = effectiveEmail;
    if (data.uid) newCustomer.firebaseUid = data.uid;
    const docRef = await transportService.addCustomer(newCustomer);

    return {
      id: docRef.id,
      username: normalizedPhone || effectiveEmail || data.uid || 'member',
      role: UserRole.CUSTOMER,
      name: data.name || defaultName,
      phone: normalizedPhone || data.phone,
      email: effectiveEmail,
    };
  };

  return { handleRegisterMember, handleOtpMemberLogin };
}
