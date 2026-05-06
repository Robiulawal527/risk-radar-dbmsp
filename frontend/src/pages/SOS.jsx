import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { Phone, Send } from "lucide-react";
export default function SOS() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Navbar />
        <div className="p-5 flex justify-center items-center min-h-[80vh]">
          <div className="glass rounded-3xl p-10 text-center max-w-md w-full red-glow">
            <h1 className="text-4xl font-black mb-8">SOS</h1>
            <button className="w-56 h-56 rounded-full bg-red-600 text-white text-5xl font-black red-glow border-8 border-red-900">
              SOS
              <span className="block text-xs font-normal mt-2">
                Tap to Alert
              </span>
            </button>
            <p className="text-slate-300 mt-8">
              Your current location will be shared with emergency contacts.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button className="bg-red-600 py-3 rounded-xl flex items-center justify-center gap-2">
                <Phone size={18} /> Call 999
              </button>
              <button className="bg-red-700 py-3 rounded-xl flex items-center justify-center gap-2">
                <Send size={18} /> Share Location
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
