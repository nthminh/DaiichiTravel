import React, { useEffect, useState } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const IOS_PROMPT_DELAY_MS = 2000;

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isInStandaloneMode()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      // Show iOS instructions after a short delay
      const timer = setTimeout(() => setShowIOSModal(true), IOS_PROMPT_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // Android / Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setShowAndroidBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShowAndroidBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShowAndroidBanner(false);
    setShowIOSModal(false);
  };

  if (showAndroidBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 safe-bottom">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-center gap-4 max-w-lg mx-auto">
          <picture>
            <source srcSet="/icon-192.webp" type="image/webp" />
            <img src="/icon-192.png" alt="Daiichi Travel" className="w-12 h-12 rounded-xl shrink-0" decoding="async" />
          </picture>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">Cài đặt Daiichi Travel</p>
            <p className="text-xs text-gray-500 mt-0.5">Thêm vào màn hình chính để truy cập nhanh hơn</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAndroidInstall}
              className="bg-daiichi-red text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 hover:bg-daiichi-red/90 active:scale-95 transition-all"
            >
              <Download size={14} />
              Cài đặt
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOSModal) {
    return (
      <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 pb-8 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <picture>
                <source srcSet="/icon-192.webp" type="image/webp" />
                <img src="/icon-192.png" alt="Daiichi Travel" className="w-12 h-12 rounded-2xl shadow-md" decoding="async" />
              </picture>
              <div>
                <p className="font-bold text-gray-800">Daiichi Travel</p>
                <p className="text-xs text-gray-500">Cài đặt ứng dụng</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-xl hover:bg-gray-100"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-5">
            Thêm Daiichi Travel vào màn hình chính để truy cập nhanh như một ứng dụng thực sự!
          </p>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Share size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Bước 1</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Nhấn vào nút <strong>Chia sẻ</strong> <Share size={12} className="inline" /> ở thanh điều hướng Safari phía dưới
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Plus size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Bước 2</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Chọn <strong>"Thêm vào Màn hình chính"</strong> từ danh sách tùy chọn
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
              <div className="w-8 h-8 bg-daiichi-red/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-daiichi-red font-bold text-xs">✓</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Bước 3</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Nhấn <strong>"Thêm"</strong> để hoàn tất cài đặt
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="mt-5 w-full py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Để sau
          </button>
        </div>
      </div>
    );
  }

  return null;
}
