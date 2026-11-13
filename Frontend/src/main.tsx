import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App.tsx';
import './index.css';

// ── Top-level error boundary – prevents a blank white page on runtime errors ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#f8fafc',
        }}>
          <div style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '2rem', maxWidth: '520px', width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h2 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>SmartRoute AI failed to load</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {this.state.error.message}
            </p>
            <pre style={{
              background: '#f1f5f9', borderRadius: '8px', padding: '0.75rem',
              fontSize: '0.75rem', color: '#475569', textAlign: 'left',
              overflowX: 'auto', marginBottom: '1rem',
            }}>
              {this.state.error.stack?.slice(0, 400)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#1d64e8', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0.5rem 1.5rem', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
