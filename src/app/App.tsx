import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ErrorBoundary from './components/ErrorBoundary';
import 'leaflet/dist/leaflet.css';
import '../styles/leaflet.css';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}