import { LayoutDashboard, Map, Bell, ShieldAlert, User, Settings, FilePlus, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
const items = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard }, { name: "Map", path: "/map", icon: Map },
  { name: "Alerts", path: "/alerts", icon: Bell }, { name: "SOS", path: "/sos", icon: ShieldAlert },
  { name: "Citizens", path: "/citizens", icon: User },
  { name: "Social Radar", path: "/social", icon: Users },
  { name: "Report Crime", path: "/map", icon: FilePlus }, { name: "Profile", path: "/profile", icon: User },
  { name: "Settings", path: "/profile", icon: Settings }, { name: "Admin", path: "/admin", icon: LayoutDashboard },
];
export default function Sidebar(){ const location=useLocation(); return <aside className="glass w-64 min-h-screen p-4 hidden lg:block"><Link to="/" className="flex items-center gap-2 mb-8"><ShieldAlert className="text-red-500"/><h1 className="text-xl font-bold">Risk <span className="text-red-500">Radar</span></h1></Link><nav className="space-y-2">{items.map(item=>{const Icon=item.icon; const active=location.pathname===item.path; return <Link key={item.name} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${active?"bg-red-600/30 text-red-400":"text-slate-300 hover:bg-slate-800"}`}><Icon size={18}/>{item.name}</Link>})}</nav></aside> }
