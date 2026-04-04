/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
  // OnePay Vietnam (tuỳ chọn — có thể cấu hình qua Settings thay thế)
  readonly VITE_ONEPAY_MERCHANT?: string
  readonly VITE_ONEPAY_ACCESS_CODE?: string
  readonly VITE_ONEPAY_HASH_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
