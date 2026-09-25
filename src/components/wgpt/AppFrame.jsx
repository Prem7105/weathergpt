'use client';

import { useEffect } from 'react';
import WeatherBackdrop from '@/components/UI/WeatherBackdrop';
import AccountModal from '@/components/Modals/AccountModal';
import CompareModal from '@/components/Modals/CompareModal';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { UI_I18N } from '@/lib/i18n';
import { useWGPT } from './WeatherGPTProvider';
import { OfflineBanner, ToastView } from './Chrome';

export default function AppFrame() {
  const {
    weather, backendLanguage, location, showToast, user, handleAuthSuccess,
    isAccountOpen, setAccountOpen, isCompareOpen, setCompareOpen,
  } = useWGPT();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setCompareOpen(false);
      setAccountOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setAccountOpen, setCompareOpen]);

  const i18n = UI_I18N[backendLanguage] || UI_I18N.english;
  const currentLoc = {
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.displayPrimary || location.city,
    displayPrimary: location.displayPrimary,
  };

  return (
    <>
      <WeatherBackdrop condition={weather?.condition} isDaytime={weather?.isDaytime} />
      <OfflineBanner />
      <ToastView />
      <PWAInstallPrompt />
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setAccountOpen(false)}
        showToast={showToast}
        onAuthSuccess={(u) => handleAuthSuccess(u)}
        currentUser={user}
      />
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setCompareOpen(false)}
        currentLoc={currentLoc}
        weather={weather}
        i18n={i18n}
        showToast={showToast}
      />
    </>
  );
}
