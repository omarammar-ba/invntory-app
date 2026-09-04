import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { clearProtectedLocalData } from './services/firebase';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught runtime error:', error, errorInfo);
  }

  private handleReset = async () => {
    clearProtectedLocalData();

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }

    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="app-viewport app-safe-screen flex items-center justify-center bg-slate-900 p-6 text-right text-white"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-800 bg-rose-900/40 text-rose-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="mb-2 text-2xl font-black text-rose-300">
              حدث خطأ مؤقت في التطبيق
            </h2>

            <p className="mb-6 text-sm leading-relaxed text-slate-400">
              بيانات المخزون محفوظة في Firebase. يمكنك إعادة تحميل التطبيق، أو مسح
              الذاكرة المؤقتة المحلية فقط إذا استمرت المشكلة.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full cursor-pointer rounded-xl bg-white py-3.5 font-black text-slate-900 shadow-lg transition-all hover:bg-slate-100"
              >
                إعادة تحميل الصفحة
              </button>

              <button
                onClick={() => void this.handleReset()}
                className="w-full rounded-xl bg-slate-700 py-3 text-xs font-bold text-slate-300 transition-all hover:bg-slate-600"
              >
                مسح الذاكرة المؤقتة فقط
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
