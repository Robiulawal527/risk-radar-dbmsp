import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import Alerts from "./pages/Alerts";
import SOS from "./pages/SOS";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import CrimeRecords from "./pages/CrimeRecords";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/sos" element={<SOS />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/crimes" element={<CrimeRecords />} />
    </Routes>
  );
}
