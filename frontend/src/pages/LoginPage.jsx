import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    try {
      setLoading(true);

      await loginWithGoogle();

      navigate("/chat");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">

        <div className="mb-8 text-center">

          <h1 className="text-3xl font-bold">
            AssamWork AI
          </h1>

          <p className="mt-2 text-slate-500">
            Welcome back
          </p>

        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-5 w-full rounded-xl border border-slate-300 bg-white py-3 font-medium transition hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="relative my-6">

          <div className="absolute inset-0 flex items-center">

            <div className="w-full border-t border-slate-200"></div>

          </div>

          <div className="relative flex justify-center">

            <span className="bg-white px-4 text-sm text-slate-500">
              or
            </span>

          </div>

        </div>

        <input
          className="mb-4 w-full rounded-xl border border-slate-300 p-3"
          placeholder="Email"
        />

        <input
          type="password"
          className="mb-4 w-full rounded-xl border border-slate-300 p-3"
          placeholder="Password"
        />

        <button
          className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white"
        >
          Sign In
        </button>

      </div>

    </div>
  );
}