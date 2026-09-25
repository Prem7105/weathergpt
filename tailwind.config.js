/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0B1120', card: '#111827', elevated: '#151F32' },
        brand: { from: '#3B82F6', to: '#14B8A6' },
        risk: {
          low: '#22C55E',
          moderate: '#F59E0B',
          high: '#F97316',
          severe: '#EF4444',
          extreme: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Telugu', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(59,130,246,0.25)',
      },
    },
  },
  plugins: [],
};
