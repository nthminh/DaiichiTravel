/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
  // Firebase Authentication
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  // OnePay Vietnam (tuỳ chọn — có thể cấu hình qua Settings thay thế)
  readonly VITE_ONEPAY_MERCHANT?: string
  readonly VITE_ONEPAY_ACCESS_CODE?: string
  readonly VITE_ONEPAY_HASH_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
