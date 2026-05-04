import { useCallback, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Trash2 } from "lucide-react";

export default function CitizenProfiles() {
  const { data: profiles, loading, refetch } = useApi(useCallback(() => api.getProfiles(), []), []);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ nid: "", name: "", type: "crime", details: "" });

  const profileList = Array.isArray(profiles) ? profiles : [];

  const handleDelete = async (nid) => {
    if (!window.confirm(`Delete profile ${nid}? This cannot be undone.`)) return;
    try {
      await api.deleteProfile(nid);
      refetch();
    } catch {
      alert("Failed to delete profile");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.recordAction(formData);
      setShowModal(false);
      setFormData({ nid: "", name: "", type: "crime", details: "" });
      refetch();
    } catch (err) {
      alert("Failed to save record");
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Navbar />
        <div className="p-5">
          <div className="flex justify-between mb-5">
            <h1 className="text-3xl font-bold">Citizen Records & Profiles</h1>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-red-600 px-5 py-2 rounded-xl hover:bg-red-700 transition"
            >
              + Record Action
            </button>
          </div>

          <div className="glass rounded-2xl overflow-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-4 text-left">NID</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Crime Score</th>
                  <th className="p-4 text-left">Philanthropy Score</th>
                  <th className="p-4 text-left">Trust Score</th>
                  <th className="p-4 text-left">Looking For</th>
                  <th className="p-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profileList.map((profile) => (
                  <tr key={profile.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                    <td className="p-4 font-mono text-slate-300">{profile.nid}</td>
                    <td className="p-4 font-bold">{profile.name}</td>
                    <td className="p-4 text-red-400 font-bold">{profile.crimeScore}</td>
                    <td className="p-4 text-green-400 font-bold">{profile.philanthropyScore}</td>
                    <td className="p-4 text-blue-400 font-bold">{profile.trustScore}</td>
                    <td className="p-4 text-slate-400">
                      {Array.isArray(profile.intents)
                        ? profile.intents.join(", ") || "Friendship"
                        : profile.intents || "Friendship"}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        title="Delete profile"
                        className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        onClick={() => handleDelete(profile.nid)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {profileList.length === 0 && !loading && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      No citizen profiles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Record Citizen Action</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">National ID (NID)</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2"
                  value={formData.nid}
                  onChange={e => setFormData({...formData, nid: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Action Type</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="crime">Commit Crime</option>
                  <option value="philanthropy">Philanthropy</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Details / Description</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 h-24"
                  value={formData.details}
                  onChange={e => setFormData({...formData, details: e.target.value})}
                ></textarea>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button" 
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-medium"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}