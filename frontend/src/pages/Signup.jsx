import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
export default function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="glass rounded-3xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <ShieldAlert className="text-red-500" />
          <h1 className="text-2xl font-bold">Create Account</h1>
        </div>
        <input
          className="w-full bg-slate-950 p-3 rounded-xl mb-4"
          placeholder="Full Name"
        />
        <input
          className="w-full bg-slate-950 p-3 rounded-xl mb-4"
          placeholder="Email"
        />
        <input
          className="w-full bg-slate-950 p-3 rounded-xl mb-4"
          placeholder="Password"
          type="password"
        />
        <Link to="/dashboard">
          <button className="w-full bg-red-600 py-3 rounded-xl font-bold">
            Sign Up
          </button>
        </Link>
        <p className="text-center text-sm text-slate-400 mt-4">
          Already have account?{" "}
          <Link to="/login" className="text-red-400">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
