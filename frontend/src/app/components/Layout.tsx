import { Outlet } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';

export default function Layout() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <Outlet />
        </div>
      </LanguageProvider>
    </AuthProvider>
  );
}
