'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBackground, iconForCondition } from '@/lib/weatherBackground';

function useCrossfade(image) {
  const [layers, setLayers] = useState([{ image, visible: true }]);

  useEffect(() => {
    setLayers((prev) => (prev[prev.length - 1]?.image === image ? prev : [...prev, { image, visible: false }]));
  }, [image]);

  useEffect(() => {
    if (!layers.some((l) => !l.visible)) return undefined;
    const raf = requestAnimationFrame(() => setLayers((prev) => prev.map((l) => ({ ...l, visible: true }))));
    return () => cancelAnimationFrame(raf);
  }, [layers]);

  useEffect(() => {
    if (layers.length <= 1) return undefined;
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), 1400);
    return () => clearTimeout(t);
  }, [layers]);

  return layers;
}

function SnowLayer() {
  const [flakes, setFlakes] = useState([]);
  // Generated after mount so server and client markup match.
  useEffect(() => {
    setFlakes(Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 8 + Math.random() * 10,
      delay: -Math.random() * 18,
      drift: (Math.random() - 0.5) * 60,
      opacity: 0.35 + Math.random() * 0.45,
    })));
  }, []);
  return (
    <div className="wb-layer">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="weather-snowflake"
          style={{
            left: `${f.left}%`, width: f.size, height: f.size, opacity: f.opacity,
            animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`, '--drift': `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

function FogLayer() {
  return (
    <div className="wb-layer">
      <div className="weather-fog-band" style={{ top: '18%', animationDuration: '38s' }} />
      <div className="weather-fog-band" style={{ top: '52%', animationDuration: '50s', animationDirection: 'reverse' }} />
      <div className="weather-fog-band" style={{ top: '80%', animationDuration: '44s' }} />
    </div>
  );
}

export default function WeatherBackdrop({ condition, isDaytime }) {
  const spec = useMemo(() => getBackground(iconForCondition(condition), isDaytime), [condition, isDaytime]);
  const layers = useCrossfade(spec.image);

  return (
    <div className="weather-backdrop" aria-hidden="true">
      {layers.map((l, i) => (
        <div
          key={l.image}
          className="wb-photo"
          style={{ backgroundImage: `url(${l.image})`, opacity: l.visible ? 1 : 0, zIndex: i }}
        />
      ))}
      <div
        className="wb-scrim"
        style={{
          background: `linear-gradient(to bottom, rgba(${spec.tint},0.72) 0%, rgba(${spec.tint},0.32) 28%, rgba(${spec.tint},0.4) 65%, rgba(${spec.tint},0.82) 100%)`,
        }}
      />
      <div className="wb-dim" />
      {spec.particle === 'rain' && <div className="wb-layer weather-particles-rain" />}
      {spec.particle === 'snow' && <SnowLayer />}
      {spec.particle === 'fog' && <FogLayer />}
    </div>
  );
}
