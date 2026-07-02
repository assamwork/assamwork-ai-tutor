import { useEffect, useState } from "react";
import { Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../../../store/authStore";

import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
} from "../services/auth";

export default function AuthPage() {
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      navigate("/chat", { replace: true });
    }
  }, [user, navigate]);

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    try {
      setLoading(true);
      setError("");

      await loginWithGoogle();
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">

      {/* Left */}

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 items-center justify-center text-white">

        <div className="max-w-lg px-12">

          <div className="mb-8 text-7xl">⚡</div>

          <h1 className="text-5xl font-bold">
            AssamWork AI
          </h1>

          <p className="mt-6 text-xl leading-9 text-blue-100">
            Your AI Tutor for APSC, ADRE,
            Assam Police, TET and every
            Assam Competitive Examination.
          </p>

        </div>

      </div>

      {/* Right */}

      <div className="flex flex-1 items-center justify-center bg-slate-100 p-8">

        <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-xl">

          <h2 className="text-3xl font-bold">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>

          <p className="mt-2 text-slate-500">
            Continue to AssamWork AI
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 py-3 hover:bg-slate-100"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="h-5 w-5"
            />

            Continue with Google

          </button>

          <div className="my-8 text-center text-slate-400">
            OR
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-4">

              <Mail size={18} />

              <input
                type="email"
                placeholder="Email"
                className="w-full py-4 outline-none"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-4">

              <Lock size={18} />

              <input
                type="password"
                placeholder="Password"
                className="w-full py-4 outline-none"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />

            </div>

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login"
                : "Create Account"}
            </button>

          </form>

          <button
            onClick={() =>
              setIsLogin(!isLogin)
            }
            className="mt-8 w-full text-center text-blue-600 hover:underline"
          >
            {isLogin
              ? "Create a new account"
              : "Already have an account? Login"}
          </button>

        </div>

      </div>

    </div>
  );
}