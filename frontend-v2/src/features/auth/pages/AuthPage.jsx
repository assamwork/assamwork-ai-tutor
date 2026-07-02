import { useEffect, useState } from "react";
import { Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../../../store/authStore";

import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
} from "../services/auth";

function getAuthErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/weak-password":
      return "Use a stronger password with at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before it finished.";
    case "auth/network-request-failed":
      return "Unable to reach Firebase. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a little and try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default function AuthPage() {
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      navigate("/study", { replace: true });
    }
  }, [user, navigate]);

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingAction, setLoadingAction] = useState(null);
  const [error, setError] = useState("");
  const loading = Boolean(loadingAction);

  async function handleGoogle() {
    try {
      setLoadingAction("google");
      setError("");

      await loginWithGoogle();
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoadingAction("email");
      setError("");

      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoadingAction(null);
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

      <div className="flex flex-1 items-center justify-center bg-slate-100 p-4 sm:p-8">

        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-10">

          <h2 className="text-3xl font-bold">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>

          <p className="mt-2 text-slate-500">
            Continue to AssamWork AI
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="h-5 w-5"
            />

            {loadingAction === "google"
              ? "Opening Google…"
              : "Continue with Google"}

          </button>

          <div className="my-8 text-center text-slate-400">
            OR
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-4">

              <Mail size={18} className="text-slate-500" />

              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                className="w-full py-4 outline-none"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-300 px-4">

              <Lock size={18} className="text-slate-500" />

              <input
                type="password"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="Password"
                className="w-full py-4 outline-none"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />

            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? loadingAction === "email"
                  ? "Please wait..."
                  : isLogin
                  ? "Login"
                  : "Create Account"
                : isLogin
                ? "Login"
                : "Create Account"}
            </button>

          </form>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
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
