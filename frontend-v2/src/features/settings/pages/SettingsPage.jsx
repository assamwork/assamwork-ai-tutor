import {
  BookOpenCheck,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  Database,
  LockKeyhole,
  MoonStar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import useAuthStore from "../../../store/authStore";

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={21} />
        </div>
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
        <div>
          <p className="text-sm font-semibold text-blue-600">Preferences</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Settings
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review your account, tutor behavior, and privacy options.
          </p>
        </div>

        <div className="mt-6 grid gap-5">
          <Section
            icon={CircleUserRound}
            title="Account"
            description="Your current signed-in AssamWork AI account."
          >
            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.displayName?.charAt(0) ||
                  user?.email?.charAt(0)?.toUpperCase() ||
                  "U"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {profile?.name || user?.displayName || "Name not available"}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {profile?.email || user?.email || "Email not available"}
                </p>
              </div>
              <ShieldCheck size={19} className="shrink-0 text-emerald-600" />
            </div>
          </Section>

          <Section
            icon={MoonStar}
            title="Appearance"
            description="Personalize how AssamWork AI looks on your devices."
          >
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Theme preferences
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Additional appearance options are coming soon.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Coming soon
              </span>
            </div>
          </Section>

          <Section
            icon={Sparkles}
            title="AI Tutor behavior"
            description="Core grounding rules used for every tutor response."
          >
            <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <BookOpenCheck
                  size={21}
                  className="mt-0.5 shrink-0 text-emerald-700"
                />
                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    Answer only from uploaded ebooks
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    This trust setting is always enabled for AssamWork AI.
                  </p>
                </div>
              </div>
              <div
                role="switch"
                aria-checked="true"
                aria-label="Answer only from uploaded ebooks, enabled and locked"
                className="flex h-7 w-12 shrink-0 items-center justify-end rounded-full bg-emerald-600 p-1"
              >
                <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
              <LockKeyhole size={14} />
              Enabled and locked
            </div>
          </Section>

          <Section
            icon={Database}
            title="Data & privacy"
            description="Understand how your current app data is handled."
          >
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Chat storage
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Chat history is currently stored for this browser session.
                  </p>
                </div>
                <LockKeyhole size={18} className="shrink-0 text-slate-400" />
              </div>
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Account access
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Authentication is managed through Firebase.
                  </p>
                </div>
                <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
              </div>
            </div>
          </Section>

          <Section
            icon={CreditCard}
            title="Subscription"
            description="Plan management and billing controls."
          >
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {profile?.plan || "Plan not available"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Subscription management is coming soon.
                </p>
              </div>
              <ChevronRight size={19} className="shrink-0 text-slate-400" />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
