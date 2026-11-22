"use client";

import { useState, type FormEvent } from "react";
import { useSignMessage } from "wagmi";
import type { Address } from "viem";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "sign-up" | "sign-in";

type AuthModalProps = {
  address?: Address;
  open: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  onLinked: (userId: string) => void;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Request failed with status ${response.status}.`);
  return result;
}

export function AuthModal({ address, open, initialMode = "sign-up", onClose, onLinked }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signMessageAsync } = useSignMessage();

  if (!open) return null;

  async function linkWallet() {
    if (!address) throw new Error("Connect a wallet before linking your account.");
    const challenge = await postJson<{ message: string }>("/api/auth/nonce", { address });
    const signature = await signMessageAsync({ message: challenge.message });
    const linked = await postJson<{ userId: string }>("/api/auth/link-wallet", {
      address,
      message: challenge.message,
      signature,
    });
    onLinked(linked.userId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!/^[^@\s]+@gmail\.com$/i.test(email.trim())) {
      setError("Enter a valid Gmail address.");
      return;
    }
    if (mode === "sign-up" && name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const result =
        mode === "sign-up"
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { data: { full_name: name.trim() } },
            })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) throw result.error;
      if (!result.data.session) {
        setNotice("Check your email to confirm the account, then sign in and link this wallet.");
        setMode("sign-in");
        return;
      }

      if (address) {
        await linkWallet();
        setNotice("Account connected and wallet linked.");
      } else {
        setNotice("Signed in successfully.");
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account linking failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="auth-panel relative w-full max-w-md p-7 text-sm text-white"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close account dialog"
          className="auth-close absolute right-4 top-4"
        >
          ×
        </button>
        <div className="auth-kicker">ARCQUANT ACCOUNT</div>
        <h2 id="auth-modal-title" className="auth-title mb-6">
          {mode === "sign-up" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="auth-wallet mb-5">
          <span className={address ? "wallet-dot connected" : "wallet-dot"} />
          {address ? `${address.slice(0, 6)}…${address.slice(-4)} connected` : "Wallet optional"}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "sign-up" && (
            <label className="auth-field block">
              <span>Full name</span>
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="auth-input"
              />
            </label>
          )}
          <label className="block">
            <span className="auth-field block">Gmail address</span>
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="name@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="auth-input"
            />
          </label>
          <label className="auth-field block">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="auth-input"
            />
          </label>
          {error && <p role="alert" className="break-words text-xs text-red-400">{error}</p>}
          {notice && <p role="status" className="break-words text-xs text-green-300">{notice}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="auth-submit w-full"
          >
            {isSubmitting
              ? "Processing..."
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-up" ? "sign-in" : "sign-up");
            setError(null);
            setNotice(null);
          }}
          className="auth-switch mt-5 w-full"
        >
          {mode === "sign-up" ? "Already registered? Sign in." : "Need an account? Sign up."}
        </button>
      </section>
    </div>
  );
}
