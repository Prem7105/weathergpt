'use client';

import { useState } from 'react';
import { t } from '@/i18n';
import { useWGPT } from '@/components/wgpt/WeatherGPTProvider';
import { WeatherHero, ForecastChart, SevenDayForecast } from '@/components/wgpt/WeatherPanels';
import { RiskPanel, ImpactPanel, DecisionPanel, ActionPanel } from '@/components/wgpt/IntelligencePanels';
import { ChatPanel } from '@/components/wgpt/ChatPanel';

const TABS = ['tab_weather', 'tab_risk', 'tab_impact', 'tab_decision', 'tab_action'];

export default function Dashboard() {
  const { language } = useWGPT();
  const [tab, setTab] = useState('tab_weather');

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6 min-w-0">
        <div className="flex gap-2 glass rounded-xl p-1.5 w-fit overflow-x-auto max-w-full">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                tab === key ? 'bg-gradient-to-r from-brand-from to-brand-to text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t(language, key)}
            </button>
          ))}
        </div>

        {tab === 'tab_weather' && (
          <div className="space-y-6">
            <WeatherHero />
            <ForecastChart />
            <SevenDayForecast />
          </div>
        )}
        {tab === 'tab_risk' && <RiskPanel />}
        {tab === 'tab_impact' && <ImpactPanel />}
        {tab === 'tab_decision' && <DecisionPanel />}
        {tab === 'tab_action' && <ActionPanel />}
      </div>

      <div className="lg:col-span-1">
        <div className="lg:sticky lg:top-20">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
