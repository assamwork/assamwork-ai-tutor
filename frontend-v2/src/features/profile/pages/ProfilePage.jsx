import {
  CalendarDays,
  Clock3,
  Coins,
  Crown,
  KeyRound,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import useAuthStore from "../../../store/authStore";
import useChatStore from "../../../store/chatStore";

function formatDate(value) {
  if (!value) return "Not available";

  const date =
    typeof value.toDate === "function"
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatProvider(provider) {
  if (!provider) return "Not available";
  if (provider === "google.com") return "Google";
  if (provider === "password") return "Email and password";
  return provider;
}

function formatSubscription(subscription) {
  if (!subscription) return "Not active";
  if (typeof subscription === "string") return subscription;
  if (typeof subscription === "boolean") {
    return subscription ? "Active" : "Not active";
  }
  if (typeof subscription.status === "string") {
    return subscription.status;
  }
  return "Details not available";
}

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const profileLoading = useAuthStore((state) => state.profileLoading);
  const chats = useChatStore((state) => state.chats);

  const displayName =
    profile?.name?.trim() ||
    user?.displayName?.trim() ||
    "Name not available";
  const email = profile?.email || user?.email || "Email not available";
  const photoURL = profile?.photoURL || user?.photoURL;
  const provider =
    profile?.provider || user?.providerData?.[0]?.providerId;
  const sessionChats = chats.filter(
    (chat) => chat.messages.length > 0
  ).length;
  const totalChats =
    typeof profile?.totalChats === "number"
      ? Math.max(profile.totalChats, sessionChats)
      : sessionChats;

  const details = [
    {
      label: "Email",
      value: email,
      icon: Mail,
    },
    {
      label: "Sign-in provider",
      value: formatProvider(provider),
      icon: KeyRound,
    },
    {
      label: "Member since",
      value: formatDate(profile?.createdAt),
      icon: CalendarDays,
    },
    {
      label: "Last login",
      value: formatDate(profile?.lastLogin),
      icon: Clock3,
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
        <div>
          <p className="text-sm font-semibold text-blue-600">Your account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Profile
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your AssamWork AI account and study usage details.
          </p>
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-28 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 sm:h-36" />
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="h-24 w-24 rounded-3xl border-4 border-white bg-white object-cover shadow-lg sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-slate-100 text-slate-500 shadow-lg sm:h-28 sm:w-28">
                  <UserRound size={40} />
                </div>
              )}

              <div className="min-w-0 flex-1 sm:pb-1">
                <h2 className="truncate text-2xl font-bold text-slate-950">
                  {displayName}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500" title={email}>
                  {email}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                <ShieldCheck size={16} />
                Authenticated account
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <MessageSquareText size={21} className="text-blue-600" />
            <p className="mt-4 text-2xl font-bold text-slate-950">{totalChats}</p>
            <p className="mt-1 text-xs text-slate-500">Total chats</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Coins size={21} className="text-amber-600" />
            <p className="mt-4 text-2xl font-bold text-slate-950">
              {typeof profile?.tokensUsed === "number"
                ? profile.tokensUsed.toLocaleString("en-IN")
                : "Not available"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Tokens used</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Crown size={21} className="text-violet-600" />
            <p className="mt-4 truncate text-lg font-bold text-slate-950">
              {profile?.plan || "Not available"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Current plan</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck size={21} className="text-emerald-600" />
            <p className="mt-4 truncate text-lg font-bold text-slate-950">
              {formatSubscription(profile?.subscription)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Subscription status</p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold text-slate-950">
            Account information
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Information currently available for your account.
          </p>

          {profileLoading ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {details.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={String(value)}>
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
