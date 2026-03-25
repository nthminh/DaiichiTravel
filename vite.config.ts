import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// reCAPTCHA v3 site keys are public by design – they are embedded in the page HTML
// so that Google can identify the site. This is NOT a secret.  If the site key is
// rotated, update it here AND in src/components/Login.tsx (the JS-side fallback).
const FALLBACK_RECAPTCHA_KEY = '6Lc-vIosAAAAAPJ1NRFhFu43lldk12EAjgii-8Ke';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY || FALLBACK_RECAPTCHA_KEY;
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Replace %VITE_RECAPTCHA_SITE_KEY% in index.html before Vite's own HTML env
      // substitution runs, so that the build never emits a "variable not defined" warning
      // when VITE_RECAPTCHA_SITE_KEY is absent from the environment.
      {
        name: 'inject-recaptcha-key',
        transformIndexHtml: {
          order: 'pre',
          handler(html: string) {
            return html.replace(/%VITE_RECAPTCHA_SITE_KEY%/g, recaptchaSiteKey);
          },
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (
              id.includes('node_modules/firebase/') ||
              id.includes('node_modules/@firebase/')
            ) {
              return 'vendor-firebase';
            }
            if (
              id.includes('node_modules/motion/') ||
              id.includes('node_modules/framer-motion/')
            ) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/exceljs/')) {
              return 'vendor-excel';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/qrcode.react/')) {
              return 'vendor-qrcode';
            }
            if (id.includes('node_modules/date-fns/')) {
              return 'vendor-date';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
