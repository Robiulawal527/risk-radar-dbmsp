import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { User, Save, Sparkles } from "lucide-react";
import { api } from "../api/client";

const INTENT_OPTIONS = ["Friendship", "Business", "Love", "Marriage", "Networking"];

export default function Profile() {
  const [form, setForm] = useState({
    nid: "",
    name: "",
    email: "",
    age: "",
    location: "",
    profession: "",
    bio: "",
    interests: "",
    intents: ["Friendship"]
  });
  const [savedProfile, setSavedProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleIntent = (intent) => {
    setForm((prev) => {
      const hasIntent = prev.intents.includes(intent);
      const intents = hasIntent ? prev.intents.filter((item) => item !== intent) : [...prev.intents, intent];
      return { ...prev, intents: intents.length ? intents : ["Friendship"] };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        age: form.age ? Number(form.age) : "",
        interests: form.interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      };
      const profile = await api.saveProfile(payload);
      setSavedProfile(profile);
      setMessage("Profile saved. You are now discoverable in Social Radar.");
    } catch (err) {
      setMessage("Could not save profile. Please check required fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Navbar />
        <div className="p-5 max-w-4xl space-y-6">
          <div className="glass rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                <User size={30} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Personal Profile</h1>
                <p className="text-slate-400">Create your public profile for friendship, business, love and marriage discovery.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <input required placeholder="National ID (NID)" className="bg-slate-950 border border-slate-800 rounded-xl p-3" value={form.nid} onChange={(e) => setField("nid", e.target.value)} />
              <input required placeholder="Full Name" className="bg-slate-950 border border-slate-800 rounded-xl p-3" value={form.name} onChange={(e) => setField("name", e.target.value)} />
              <input type="email" placeholder="Email" className="bg-slate-950 border border-slate-800 rounded-xl p-3" value={form.email} onChange={(e) => setField("email", e.target.value)} />
              <input type="number" placeholder="Age" className="bg-slate-950 border border-slate-800 rounded-xl p-3" value={form.age} onChange={(e) => setField("age", e.target.value)} />
              <input placeholder="Location" className="bg-slate-950 border border-slate-800 rounded-xl p-3" value={form.location} onChange={(e) => setField("location", e.target.value)} />
              <input placeholder="Profession" className="bg-slate-950 border border-slate-800 rounded-xl p-3" value={form.profession} onChange={(e) => setField("profession", e.target.value)} />
              <input placeholder="Interests (comma separated)" className="bg-slate-950 border border-slate-800 rounded-xl p-3 md:col-span-2" value={form.interests} onChange={(e) => setField("interests", e.target.value)} />
              <textarea placeholder="Bio" className="bg-slate-950 border border-slate-800 rounded-xl p-3 md:col-span-2 h-28 resize-none" value={form.bio} onChange={(e) => setField("bio", e.target.value)} />

              <div className="md:col-span-2">
                <p className="text-sm text-slate-400 mb-2">Looking for</p>
                <div className="flex flex-wrap gap-2">
                  {INTENT_OPTIONS.map((intent) => (
                    <button
                      type="button"
                      key={intent}
                      onClick={() => toggleIntent(intent)}
                      className={`px-3 py-1.5 rounded-full border transition ${
                        form.intents.includes(intent)
                          ? "bg-red-600/20 text-red-300 border-red-500"
                          : "bg-slate-900 text-slate-300 border-slate-700"
                      }`}
                    >
                      {intent}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 font-semibold">
                  <Save size={16} />
                  {loading ? "Saving..." : "Save Personal Profile"}
                </button>
              </div>
            </form>

            {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
          </div>

          {savedProfile && (
            <div className="glass rounded-3xl p-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles size={18} className="text-red-400" /> Profile Snapshot</h2>
              <p className="text-slate-400 mt-1">{savedProfile.name} • Trust Score {savedProfile.trustScore}/100</p>
              <p className="mt-3 text-slate-300">{savedProfile.bio || "No bio added yet."}</p>
              <p className="mt-2 text-sm text-slate-400">
                Intents: {savedProfile.intents.join(", ")} | Interests: {(savedProfile.interests || []).join(", ") || "N/A"}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
