'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MLEvaluationDashboard() {
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/ml-benchmark')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setBenchmark(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#0a0f1d', color: '#f1f5f9', padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              WeatherGPT Intelligence Engine
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0.25rem 0 0 0', color: '#ffffff' }}>
              🔬 ML Model Performance &amp; Evaluation Dashboard
            </h1>
          </div>
          <Link
            href="/"
            style={{ padding: '0.5rem 1rem', background: '#1e293b', color: '#94a3b8', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', border: '1px solid #334155', fontWeight: 500 }}
          >
            ← Back to WeatherGPT
          </Link>
        </header>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>Loading verified ML metrics...</div>
        ) : !benchmark ? (
          <div style={{ padding: '2rem', background: '#1e293b', borderRadius: '12px', textAlign: 'center', color: '#ef4444' }}>
            ML Benchmark report could not be loaded. Ensure benchmark metadata is present.
          </div>
        ) : (
          <div>
            {/* Top Cards: Paradigm & Split */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Paradigm Choice</span>
                <h3 style={{ margin: '0.35rem 0', color: '#38bdf8', fontSize: '1.25rem' }}>Supervised Learning</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Atmospheric physics is non-stationary and exogenous. No reinforcement learning exploration in safety-critical weather forecasting.
                </p>
              </div>

              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Chronological Split</span>
                <h3 style={{ margin: '0.35rem 0', color: '#10b981', fontSize: '1.25rem' }}>{benchmark.dataset?.totalSamples?.toLocaleString()} Samples</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Train (70%) ➔ Val (15%) ➔ Held-Out Test (15%). No random shuffle; zero future-target leakage.
                </p>
              </div>

              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Selected Model</span>
                <h3 style={{ margin: '0.35rem 0', color: '#f59e0b', fontSize: '1.25rem' }}>HistGradientBoosting</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Dual-Task: T+1 Point Regressor + Calibrated Heavy-Rain Classifier (0.42 ms latency).
                </p>
              </div>
            </div>

            {/* Task A: Regression Table */}
            <section style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '1.5rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#38bdf8' }}>
                📊 Task A: Numerical Point Prediction (Regression Benchmark)
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
                Evaluated on held-out unseen test period (31,557 hourly samples across 8 Indian metros).
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.75rem' }}>Candidate Model</th>
                      <th style={{ padding: '0.75rem' }}>Family</th>
                      <th style={{ padding: '0.75rem' }}>MAE (mm)</th>
                      <th style={{ padding: '0.75rem' }}>RMSE (mm)</th>
                      <th style={{ padding: '0.75rem' }}>R² Score</th>
                      <th style={{ padding: '0.75rem' }}>Heavy Rain MAE</th>
                      <th style={{ padding: '0.75rem' }}>Latency (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmark.taskA_Regression?.candidates?.map((c, idx) => {
                      const isSelected = c.model.includes('Selected');
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #1e293b', background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#38bdf8' : '#e2e8f0' }}>
                            {c.model} {isSelected && '🏆'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{c.family}</td>
                          <td style={{ padding: '0.75rem' }}>{c.mae.toFixed(4)}</td>
                          <td style={{ padding: '0.75rem', fontWeight: isSelected ? 700 : 400 }}>{c.rmse.toFixed(4)}</td>
                          <td style={{ padding: '0.75rem', color: isSelected ? '#10b981' : '#cbd5e1' }}>{c.r2.toFixed(4)}</td>
                          <td style={{ padding: '0.75rem' }}>{c.heavyRainMae.toFixed(2)} mm</td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>{c.latencyMs} ms</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Task B: Classification Table & Confusion Matrix */}
            <section style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '1.5rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#10b981' }}>
                🎯 Task B: Hazard Classification (P[Precipitation &gt; 10 mm/h])
              </h2>
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.75rem' }}>Candidate Model</th>
                      <th style={{ padding: '0.75rem' }}>Precision</th>
                      <th style={{ padding: '0.75rem' }}>Recall</th>
                      <th style={{ padding: '0.75rem' }}>F1-Score</th>
                      <th style={{ padding: '0.75rem' }}>Macro F1</th>
                      <th style={{ padding: '0.75rem' }}>ROC-AUC</th>
                      <th style={{ padding: '0.75rem' }}>Brier Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmark.taskB_Classification?.candidates?.map((c, idx) => {
                      const isSelected = c.model.includes('Selected');
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #1e293b', background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#10b981' : '#e2e8f0' }}>
                            {c.model} {isSelected && '🏆'}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{(c.precision * 100).toFixed(1)}%</td>
                          <td style={{ padding: '0.75rem', fontWeight: isSelected ? 700 : 400 }}>{(c.recall * 100).toFixed(1)}%</td>
                          <td style={{ padding: '0.75rem' }}>{c.f1.toFixed(4)}</td>
                          <td style={{ padding: '0.75rem' }}>{c.macroF1.toFixed(4)}</td>
                          <td style={{ padding: '0.75rem', color: '#38bdf8' }}>{c.rocAuc.toFixed(4)}</td>
                          <td style={{ padding: '0.75rem', color: '#10b981' }}>{c.brierScore.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Confusion Matrix & Calibration Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#e2e8f0', fontSize: '0.95rem' }}>Held-Out Test Confusion Matrix</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                    <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8' }}>True Negatives</div>
                      <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{benchmark.taskB_Classification?.confusionMatrix?.trueNegatives?.toLocaleString()}</strong>
                    </div>
                    <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8' }}>False Positives</div>
                      <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{benchmark.taskB_Classification?.confusionMatrix?.falsePositives?.toLocaleString()}</strong>
                    </div>
                    <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8' }}>False Negatives</div>
                      <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{benchmark.taskB_Classification?.confusionMatrix?.falseNegatives?.toLocaleString()}</strong>
                    </div>
                    <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                      <div style={{ color: '#94a3b8' }}>True Positives</div>
                      <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{benchmark.taskB_Classification?.confusionMatrix?.truePositives?.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#e2e8f0', fontSize: '0.95rem' }}>Uncertainty &amp; Calibration</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    <li><strong>Brier Score:</strong> {benchmark.calibration?.brierScore} (Well-calibrated probability)</li>
                    <li><strong>Reliability:</strong> {benchmark.calibration?.reliabilityIndex}</li>
                    <li><strong>90% Prediction Interval Nominal Coverage:</strong> {benchmark.calibration?.predictionIntervalNominalCoverage}</li>
                    <li><strong>90% Prediction Interval Empirical Coverage:</strong> {benchmark.calibration?.predictionIntervalEmpiricalCoverage}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Feature Importance */}
            <section style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f59e0b' }}>
                🔍 Permutation Feature Importance (Top Atmospheric Drivers)
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {benchmark.featureImportance?.map((f, idx) => (
                  <div key={idx} style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>#{f.rank} {f.feature}</span>
                    <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{(f.importance * 100).toFixed(2)}%</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
