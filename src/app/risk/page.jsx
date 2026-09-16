'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import styles from './risk.module.css';

const RiskMap = dynamic(() => import('./risk-map'), { ssr: false, loading: () => <div className={styles.loading}>Loading live risk map...</div> });

export default function RiskPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>WeatherGPT intelligence</p><h1>Live Weather Risk Map</h1></div>
        <Link href="/" className={styles.back}>Back to WeatherGPT</Link>
      </header>
      <RiskMap />
    </main>
  );
}
