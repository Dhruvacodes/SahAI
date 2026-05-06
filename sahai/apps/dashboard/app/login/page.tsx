"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "../../context/AuthContext";

/**
 * Login page with demo button (primary) + email/password form (secondary).
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, demoLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await demoLogin();
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Demo login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          SahAI Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Sign in</h1>

        {errorMessage ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {/* Demo login button — primary */}
        <button
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4 text-lg font-black text-white shadow-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          onClick={handleDemoLogin}
          type="button"
        >
          🏥 Demo as ANM Supervisor (Pune District)
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">OR SIGN IN WITH CREDENTIALS</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mt-4 block text-sm font-bold text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="rekha@example.org"
              type="email"
              value={email}
            />
          </label>

          <label className="mt-4 block text-sm font-bold text-slate-700">
            Password
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••"
              type="password"
              value={password}
            />
          </label>

          <button
            className="mt-6 w-full rounded-md bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400 transition-colors"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
