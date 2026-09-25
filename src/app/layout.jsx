import './globals.css';
import './glass-theme.css';
import './tailwind.css';
import WeatherGPTProvider from '@/components/wgpt/WeatherGPTProvider';
import AppFrame from '@/components/wgpt/AppFrame';
import ErrorBoundary from '@/components/UI/ErrorBoundary';

export const metadata = {
  title: 'WeatherGPT — AI Weather Intelligence for a Safer India',
  description: 'WeatherGPT: AI-powered conversational weather and disaster-risk assistant for India in 10 Indian languages.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/weatherGPT%20logo.png',
    apple: '/icons/weatherGPT%20logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WeatherGPT',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B1120',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&family=Noto+Sans+Bengali:wght@400;500;700&family=Noto+Sans+Devanagari:wght@400;500;700&family=Noto+Sans+Tamil:wght@400;500;700&family=Noto+Sans+Telugu:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (r) { r.update(); }).catch(function () {}); }); }` }} />
        <ErrorBoundary>
          <WeatherGPTProvider>
            <AppFrame />
            <div className="relative z-[1]">{children}</div>
          </WeatherGPTProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
