"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "../../context/AuthContext";

/**
 * Renders a simple dashboard login form backed by the auth context.
 *
 * @returns Login page for dashboard users.
 */
export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Submits dashboard credentials and redirects after successful login.
   *
   * @param event - Form submit event.
   */
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

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
        onSubmit={handleSubmit}
      >
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          SahAI Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Sign in</h1>

        {errorMessage ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <label className="mt-6 block text-sm font-bold text-slate-700">
          Email
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none focus:border-emerald-600"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="mt-4 block text-sm font-bold text-slate-700">
          Password
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none focus:border-emerald-600"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        <button
          className="mt-6 w-full rounded-md bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

