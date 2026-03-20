import React from 'react';
import type { Language } from '../constants/translations';

interface Props {
  language: Language;
  onSubmit: (email: string) => void;
  onCancel: () => void;
}

/** Small overlay shown when a magic-link email is opened on a different device than where it was requested */
export function EmailLinkReenterForm({ language, onSubmit, onCancel }: Props) {
  const [email, setEmail] = React.useState('');
  const isVi = language === 'vi';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        <p className="text-lg font-bold text-gray-800 text-center">
          {isVi ? '📧 Xác nhận email đăng nhập' : '📧 Confirm sign-in email'}
        </p>
        <p className="text-sm text-gray-500 text-center">
          {isVi
            ? 'Vui lòng nhập lại địa chỉ email bạn đã dùng để yêu cầu link đăng nhập.'
            : 'Please re-enter the email address you used to request the sign-in link.'}
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); if (email.trim()) onSubmit(email.trim()); }}
          className="space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
          >
            {isVi ? 'Xác nhận' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-gray-400 text-xs hover:text-gray-600 transition-colors"
          >
            {isVi ? 'Huỷ' : 'Cancel'}
          </button>
        </form>
      </div>
    </div>
  );
}
