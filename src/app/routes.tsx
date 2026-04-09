import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CrimeAnalytics from "./pages/CrimeAnalytics";
import SafeRoute from "./pages/SafeRoute";
import Reports from "./pages/Reports";
import Profiles from "./pages/Profiles";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { 
        index: true, 
        element: (
          <ProtectedRoute requireAuth={false}>
            <Login />
          </ProtectedRoute>
        )
      },
      { 
        path: "signup", 
        element: (
          <ProtectedRoute requireAuth={false}>
            <Signup />
          </ProtectedRoute>
        )
      },
      { 
        path: "dashboard", 
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )
      },
      { 
        path: "admin", 
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        )
      },
      { 
        path: "analytics", 
        element: (
          <ProtectedRoute>
            <CrimeAnalytics />
          </ProtectedRoute>
        )
      },
      { 
        path: "safe-route", 
        element: (
          <ProtectedRoute>
            <SafeRoute />
          </ProtectedRoute>
        )
      },
      { 
        path: "reports", 
        element: (
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        )
      },
      { 
        path: "profiles", 
        element: (
          <ProtectedRoute>
            <Profiles />
          </ProtectedRoute>
        )
      },
      { path: "*", Component: NotFound },
    ],
  },
]);