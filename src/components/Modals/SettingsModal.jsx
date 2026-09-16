'use client';

import NotificationSettings from '@/components/Notifications/NotificationSettings';

export default function SettingsModal({ isOpen, onClose, showToast, currentLoc, authenticatedUser }) {
  if (!isOpen) return null;

  return (
    <div className="compare-backdrop" onClick={onClose}>
      <div className="settings-modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="compare-modal-header">
          <h2 className="compare-modal-title">AI & notification settings</h2>
          <button className="compare-modal-close" onClick={onClose}>Close</button>
        </div>
        <p className="settings-desc">
          AI providers, when configured, run securely on the server. If none is configured, WeatherGPT uses its local structured-weather explanation.
        </p>
        <NotificationSettings currentLoc={currentLoc} authenticatedUser={authenticatedUser} showToast={showToast} />
        <div className="settings-actions">
          <button className="header-btn active" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
