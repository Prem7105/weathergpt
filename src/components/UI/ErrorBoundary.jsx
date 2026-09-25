'use client';

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WeatherGPT Component Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="glass rounded-2xl p-8 max-w-md text-center">
            <h2 className="text-lg font-semibold text-risk-severe">Something went wrong</h2>
            <p className="text-sm text-gray-400 mt-3 mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-from to-brand-to text-sm font-semibold"
              onClick={() => window.location.reload()}
            >
              Reload WeatherGPT
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
