'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './RiskIntelligenceCard.module.css';

export default function RiskIntelligenceCard({
  riskData,
  persona = 'citizen',
  language = 'english',
  onSelectScenario,
  activeScenario = null,
  onSimulateSms,
  isOffline = false,
  offlineSyncTime = null
}) {
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);

  const risk = riskData?.risk || riskData;
  const alert = riskData?.alert;
  const incidents = riskData?.incidents?.incidents || (Array.isArray(riskData?.incidents) ? riskData.incidents : []);
  const incidentAdvisory = riskData?.incidents?.advisory;
  const decision = risk?.impactDecision?.decision;
  const impacts = risk?.impactDecision?.impacts || [];
  const drivers = risk?.factors || risk?.drivers || [];
  const dataStatus = isOffline ? 'offline' : (riskData?.dataStatus || 'live');
  const level = risk?.level || 'low';
  const hazard = risk?.type || risk?.hazard || 'weather';

  const peakTime = risk?.peakRisk?.time
    ? new Date(risk.peakRisk.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSmsClick = async () => {
    if (!onSimulateSms) return;
    setSmsSending(true);
    setSmsStatus(null);
    try {
      const res = await onSimulateSms();
      setSmsStatus(res);
      setTimeout(() => setSmsStatus(null), 5000);
    } catch {
      setSmsStatus({ success: false, error: 'SMS dispatch failed' });
    } finally {
      setSmsSending(false);
    }
  };

  const getLevelBadgeClass = (lvl) => {
    if (lvl === 'severe') return styles.badgeCritical;
    if (lvl === 'high') return styles.badgeHigh;
    if (lvl === 'moderate') return styles.badgeModerate;
    return styles.badgeLow;
  };

  return (
    <section className={styles.container} aria-label="Risk & Decision Intelligence">
      {/* Pipeline Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.pipelineTrace}>
            WEATHER ➔ RISK ➔ IMPACT ➔ REALITY ➔ DECISION
          </div>
          <h2 className={styles.title}>
            <span>{hazard === 'flood' ? '🌊' : hazard === 'heat' ? '☀️' : hazard === 'wind' ? '💨' : '⚠️'}</span>
            <span>{hazard.toUpperCase()} INTELLIGENCE</span>
            <span className={`${styles.levelBadge} ${getLevelBadgeClass(level)}`}>
              {level.toUpperCase()}
            </span>
          </h2>
        </div>

        <div className={styles.headerRight}>
          <span className={`${styles.statusPill} ${isOffline ? styles.statusOffline : activeScenario ? styles.statusDemo : styles.statusLive}`}>
            {isOffline ? `OFFLINE · Cached` : activeScenario ? `DEMO SCENARIO` : `LIVE · Open-Meteo`}
          </span>
          {offlineSyncTime && (
            <span className={styles.syncTime}>Last sync: {offlineSyncTime}</span>
          )}
        </div>
      </div>

      {/* Scenario Switcher Bar */}
      <div className={styles.scenarioBar}>
        <span className={styles.scenarioLabel}>Intelligence Mode:</span>
        <button
          className={`${styles.scenarioBtn} ${!activeScenario ? styles.scenarioActive : ''}`}
          onClick={() => onSelectScenario(null)}
          title="Query live Open-Meteo meteorological feed"
        >
          🌐 Live Feed
        </button>
        <button
          className={`${styles.scenarioBtn} ${activeScenario === 'heavy_rain' ? styles.scenarioActive : ''}`}
          onClick={() => onSelectScenario('heavy_rain')}
          title="Monsoon Flood Scenario (Ahmedabad / Mumbai 65mm Rain)"
        >
          🌧️ Demo: Heavy Flood
        </button>
        <button
          className={`${styles.scenarioBtn} ${activeScenario === 'heatwave' ? styles.scenarioActive : ''}`}
          onClick={() => onSelectScenario('heatwave')}
          title="Severe Heatwave Scenario (44°C Peak)"
        >
          🌡️ Demo: Heatwave
        </button>
        <button
          className={`${styles.scenarioBtn} ${activeScenario === 'storm' ? styles.scenarioActive : ''}`}
          onClick={() => onSelectScenario('storm')}
          title="High Wind Squall Scenario (65 km/h Gusts)"
        >
          💨 Demo: High Wind
        </button>
      </div>

      {/* Core Grid: WHY (Drivers) & WHAT (Impacts) */}
      <div className={styles.grid}>
        {/* WHY: Risk Drivers */}
        <div className={styles.card}>
          <div className={styles.cardKicker}>WHY RISK IS {level.toUpperCase()}</div>
          <div className={styles.driversList}>
            {drivers.length > 0 ? (
              drivers.map((driver, idx) => (
                <div key={idx} className={styles.driverRow}>
                  <span className={styles.driverLabel}>{driver.label}</span>
                  <span className={styles.driverValue}>{driver.value}</span>
                </div>
              ))
            ) : (
              <div className={styles.emptyNote}>Live weather signals within standard threshold parameters.</div>
            )}
            {peakTime && (
              <div className={styles.peakRow}>
                <span>⏱️ Peak Window:</span>
                <strong>{peakTime}</strong>
              </div>
            )}
          </div>
        </div>

        {/* WHAT: Potential Impacts */}
        <div className={styles.card}>
          <div className={styles.cardKicker}>WHAT WILL BE IMPACTED</div>
          <ul className={styles.impactList}>
            {impacts.length > 0 ? (
              impacts.map((imp, idx) => (
                <li key={idx} className={styles.impactItem}>
                  <span>⚠️</span> {imp}
                </li>
              ))
            ) : (
              <li className={styles.impactItem}>No severe physical disruption anticipated under current metrics.</li>
            )}
          </ul>
        </div>
      </div>

      {/* DECISION & ACTION (Persona Tailored) */}
      <div className={styles.decisionBox}>
        <div className={styles.decisionHeader}>
          <span className={styles.decisionRole}>ACTIONABLE DECISION ({persona.toUpperCase()}):</span>
          <span className={styles.decisionPriority}>Priority: {decision?.priority?.toUpperCase() || 'MONITOR'}</span>
        </div>
        <div className={styles.decisionContent}>
          <strong>👉 {decision?.recommendations?.[0] || 'Monitor live weather telemetry and official safety bulletins.'}</strong>
          {decision?.recommendations?.[1] && (
            <p className={styles.decisionSecondary}>• {decision.recommendations[1]}</p>
          )}
        </div>
      </div>

      {/* GROUND REALITY INCIDENT FUSION */}
      {incidents.length > 0 && (
        <div className={styles.realityBox}>
          <div className={styles.realityHeader}>
            <span className={styles.realityTitle}>📍 GROUND REALITY FUSION</span>
            <span className={`${styles.verificationPill} ${styles['ver_' + (incidents[0].verification?.toLowerCase() || 'reported')]}`}>
              {incidents[0].verification}
            </span>
          </div>
          <div className={styles.realityBody}>
            <p>
              <strong>{incidents[0].category.replace('_', ' ')}</strong> reported <strong>{incidents[0].distanceKm} km away</strong> ({incidents[0].location?.name || 'Local sector'}).
            </p>
            {incidentAdvisory?.text && (
              <p className={styles.realityAdvisory}>&ldquo;{incidentAdvisory.text}&rdquo;</p>
            )}
            <span className={styles.realitySource}>Source: {incidents[0].source} · {new Date(incidents[0].publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}

      {/* Action Footer: Link to Map & SMS simulation */}
      <div className={styles.footerBar}>
        <Link href="/risk" className={styles.mapLinkBtn}>
          🗺️ Open Full Risk Map & Spatial Heatmap ➔
        </Link>
        <button
          className={styles.smsBtn}
          onClick={handleSmsClick}
          disabled={smsSending}
          title="Simulate dispatching a 160-char SMS alert to a feature phone"
        >
          {smsSending ? '⏳ Dispatching...' : '📱 Simulate Feature-Phone SMS'}
        </button>
      </div>

      {smsStatus && (
        <div className={styles.smsAlertNotice}>
          <strong>SMS Payload ({smsStatus.mode}):</strong> {smsStatus.body}
          <br /><small>{smsStatus.note || `Message Sid: ${smsStatus.messageId}`}</small>
        </div>
      )}
    </section>
  );
}
