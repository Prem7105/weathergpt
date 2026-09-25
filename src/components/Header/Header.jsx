'use client';

import Link from 'next/link';
import { getWeatherEmoji } from '@/lib/weatherApi';

export default function Header({
  currentLoc,
  weather,
  i18n,
  isCompareOpen,
  onOpenCompare,
  onClearChat,
  onOpenAccount,
  authenticatedUser,
  onOpenSettings
}) {
  const avatarSrc = authenticatedUser?.profileImage || '/default-avatar.svg';

  return (
    <header className="main-header">
      <div className="header-left-info">
        <h1 className="header-city-title">
          <span>{weather ? getWeatherEmoji(weather.condition) : '📍'}</span>
          <span>{currentLoc.displayPrimary || currentLoc.city}</span>
          {currentLoc.isGps && <span className="header-gps-pill">📍 Live GPS</span>}
          {weather && <span className="header-condition-pill">· {weather.condition}</span>}
        </h1>
      </div>
      <div className="header-actions-group">
        <Link
          className="header-btn"
          href={currentLoc.latitude != null && currentLoc.longitude != null
            ? `/risk?${new URLSearchParams({ lat: currentLoc.latitude, lon: currentLoc.longitude, name: currentLoc.displayPrimary || currentLoc.city || '' })}`
            : '/risk'}
        >
          Risk map
        </Link>
        <button
          className={`account-icon-btn ${authenticatedUser ? 'has-user' : ''}`}
          onClick={onOpenAccount}
          title={authenticatedUser ? `Account: ${authenticatedUser.name}` : 'Log in or sign up'}
          aria-label={authenticatedUser ? `Account: ${authenticatedUser.name}` : 'Log in or sign up'}
        >
          <img src={avatarSrc} alt={authenticatedUser ? `${authenticatedUser.name} profile` : 'Login'} />
        </button>
        <button
          id="compare-mode-btn"
          className={`header-btn ${isCompareOpen ? 'active' : ''}`}
          onClick={onOpenCompare}
          title="Compare two Indian cities"
        >
          {i18n.compare}
        </button>
        <button
          id="clear-chat-btn"
          className="header-btn"
          onClick={onClearChat}
          title="Clear Chat History"
        >
          {i18n.clear}
        </button>
        <button
          className="header-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
