import { createRoot } from 'react-dom/client';

import { setBaseUrl } from '@/api';
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
