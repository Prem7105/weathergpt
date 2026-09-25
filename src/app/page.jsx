'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CloudLightning } from 'lucide-react';
import { t } from '@/i18n';
import { useWGPT } from '@/components/wgpt/WeatherGPTProvider';
import { RoleSelector, LanguageSelector, LocationPicker } from '@/components/wgpt/Selectors';

export default function Landing() {
  const { language, completeOnboarding } = useWGPT();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <CloudLightning className="text-brand-to" size={32} />
          <span className="text-2xl font-bold">{t(language, 'app_name')}</span>
        </div>
        <p className="text-gray-400 max-w-md mx-auto">{t(language, 'tagline')}</p>
      </motion.div>

      <div className="w-full max-w-md space-y-6">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{t(language, 'select_role')}</label>
          <RoleSelector />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{t(language, 'select_language')}</label>
          <LanguageSelector />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">{t(language, 'location')}</label>
          <LocationPicker />
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            completeOnboarding();
            router.push('/dashboard');
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-from to-brand-to font-semibold shadow-glow"
        >
          {t(language, 'enter_dashboard')}
        </motion.button>
      </div>

      <div className="mt-16 text-xs text-gray-600 max-w-lg text-center">
        Problem Statement 26068 · Smart India Hackathon 2026 · Theme: Disaster Management · Team SIHnergy
      </div>
    </div>
  );
}
