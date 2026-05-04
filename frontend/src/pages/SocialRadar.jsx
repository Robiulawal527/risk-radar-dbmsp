import { useCallback, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Shield, ShieldAlert, Heart, Briefcase, Users, Edit3 } from "lucide-react";

export default function SocialRadar() {
  const { data: profiles, loading, refetch } = useApi(useCallback(() => api.getProfiles(), []), []);
  const [editingProfile, setEditingProfile] = useState(null);
  const [activeIntent, setActiveIntent] = useState("All");
  const [formData, setFormData] = useState({ bio: "", profession: "", intents: "Friendship" });

  const handleEditClick = (profile) => {
    setEditingProfile(profile);
    const intents = profile.intents;
    const intentValue = Array.isArray(intents) ? intents[0] || "Friendship" : intents || "Friendship";
    setFormData({
      bio: profile.bio || "",
      profession: profile.profession || "",
      intents: intentValue,
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.updateProfile(editingProfile.nid, formData);
      setEditingProfile(null);
      refetch();
    } catch (err) {
      alert("Failed to update profile");
    }
  };

  const profileList = Array.isArray(profiles) ? profiles : [];
  const filteredProfiles = profileList.filter((profile) => {
    if (activeIntent === "All") return true;
    return (profile.intents || []).includes(activeIntent);
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <Navbar />
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Users className="text-red-500" size={32} />
                Social Radar
              </h1>
              <p className="text-slate-400 mt-1">Discover and evaluate people for social and business connections.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", "Friendship", "Business", "Love", "Marriage", "Networking"].map((intent) => (
                <button
                  key={intent}
                  onClick={() => setActiveIntent(intent)}
                  className={`px-3 py-1.5 rounded-full border text-sm ${
                    activeIntent === intent
                      ? "bg-red-600/20 border-red-500 text-red-300"
                      : "bg-slate-900 border-slate-700 text-slate-300"
                  }`}
                >
                  {intent}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400">Loading profiles...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProfiles.map((profile) => {
                const riskLevel = profile.crimeScore > 5 ? "High" : profile.crimeScore > 0 ? "Medium" : "Low";
                const isTrustworthy = profile.philanthropyScore > 3 && profile.crimeScore === 0;

                return (
                  <div key={profile.id} className="glass rounded-3xl p-6 relative flex flex-col hover:border-red-500/30 transition border border-transparent group">
                    <button 
                      onClick={() => handleEditClick(profile)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-white bg-slate-900/50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <Edit3 size={16} />
                    </button>

                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold border-2 border-slate-700">
                        {profile.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{profile.name}</h2>
                        <p className="text-slate-400 text-sm font-mono">{profile.profession || "Unknown Profession"}</p>
                      </div>
                    </div>

                    <div className="mb-6 flex-1">
                      <p className="text-slate-300 italic text-sm mb-4">"{profile.bio || "No bio available."}"</p>
                      <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900/50 p-2 rounded-lg inline-flex">
                        {(profile.intents || []).includes("Business") ? <Briefcase size={14} className="text-blue-400"/> : 
                         (profile.intents || []).includes("Love") || (profile.intents || []).includes("Marriage") ? <Heart size={14} className="text-pink-400"/> :
                         <Users size={14} className="text-green-400"/>}
                        Looking for: <span className="font-semibold text-white">{(profile.intents || ["Friendship"]).join(", ")}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Risk Assessment</span>
                        {isTrustworthy && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-md font-bold">Recommended</span>}
                      </div>
                      <div className="mb-3 text-xs text-slate-400">Trust Score: <span className="text-blue-300 font-semibold">{profile.trustScore}/100</span></div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-slate-900 rounded-xl p-3 flex flex-col items-center">
                          <span className="text-2xl font-black text-red-400">{profile.crimeScore}</span>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Crime</span>
                        </div>
                        <div className="bg-slate-900 rounded-xl p-3 flex flex-col items-center">
                          <span className="text-2xl font-black text-green-400">{profile.philanthropyScore}</span>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Charity</span>
                        </div>
                      </div>

                      {riskLevel === "High" ? (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 p-2 rounded-lg font-medium">
                          <ShieldAlert size={16} /> Avoid Business / Marriage
                        </div>
                      ) : riskLevel === "Medium" ? (
                        <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-950/30 p-2 rounded-lg font-medium">
                          <ShieldAlert size={16} /> Proceed with Caution
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-950/30 p-2 rounded-lg font-medium">
                          <Shield size={16} /> Safe Profile
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredProfiles.length === 0 && !loading && (
                <div className="col-span-full py-20 text-center text-slate-500 glass rounded-3xl">
                  No profiles found for this intent.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {editingProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Edit Social Profile</h2>
            <form onSubmit={handleUpdate} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Profession</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-red-500 transition outline-none"
                  value={formData.profession}
                  onChange={e => setFormData({...formData, profession: e.target.value})}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Primary Intent</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-red-500 transition outline-none"
                  value={formData.intents}
                  onChange={e => setFormData({...formData, intents: e.target.value})}
                >
                  <option value="Friendship">Friendship</option>
                  <option value="Business">Business Partner</option>
                  <option value="Love">Love & Dating</option>
                  <option value="Marriage">Marriage</option>
                  <option value="Networking">Professional Networking</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Personal Bio</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 h-32 text-white focus:border-red-500 transition outline-none resize-none"
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  placeholder="Write a short bio about yourself..."
                ></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  className="flex-1 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition font-medium"
                  onClick={() => setEditingProfile(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-lg shadow-red-600/20"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}