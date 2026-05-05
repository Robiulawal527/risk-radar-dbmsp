import { Link } from "react-router-dom";
import { Bell, Map, ShieldAlert, Siren, Route } from "lucide-react";
export default function Landing() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554,#030712_55%)]">
      <nav className="h-16 px-8 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold text-xl">
          <ShieldAlert className="text-red-500" />
          Risk <span className="text-red-500">Radar</span>
        </div>
        <div className="flex gap-3">
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg border border-slate-700"
          >
            Login
          </Link>
          <Link to="/signup" className="px-4 py-2 rounded-lg bg-red-600">
            Sign Up
          </Link>
        </div>
      </nav>
      <section className="px-8 py-24 max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight">
            See the risk.
            <br />
            <span className="text-red-500">Avoid the danger.</span>
            <br />
            Stay ahead.
          </h1>
          <p className="mt-6 text-slate-300 max-w-xl">
            Explore crime heatmaps, check area risk scores, receive alerts, and
            find safer routes across Bangladesh.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              to="/dashboard"
              className="px-6 py-3 rounded-xl bg-red-600 red-glow"
            >
              Get Started
            </Link>
            <Link
              to="/map"
              className="px-6 py-3 rounded-xl border border-slate-700"
            >
              View Map
            </Link>
          </div>
        </div>
        <div className="glass rounded-3xl p-8 red-glow">
          <div className="h-80 rounded-3xl bg-[radial-gradient(circle,#ef4444,#111827_45%,#020617)] flex items-center justify-center">
            <ShieldAlert size={150} className="text-red-300" />
          </div>
        </div>
      </section>
      <section className="px-8 max-w-7xl mx-auto grid md:grid-cols-5 gap-4 pb-20">
        {[
          ["Crime Heatmap", Map],
          ["Safe Route", Route],
          ["SOS Alert", Siren],
          ["Real-time Alerts", Bell],
          ["Risk Shield", ShieldAlert],
        ].map(([title, Icon]) => (
          <div key={title} className="glass rounded-2xl p-5 text-center">
            <Icon className="mx-auto text-red-500 mb-3" />
            <h3 className="font-bold">{title}</h3>
          </div>
        ))}
      </section>
    </main>
  );
}
