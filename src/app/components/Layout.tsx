import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Outlet />
    </div>
  );
}
