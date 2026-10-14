"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { say, type Lang } from "@/lib/i18n/strings";

/** One blank: her email. The link signs her in. */
export function SignIn({ db }: { db: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lang: Lang = typeof navigator !== "undefined" && navigator.language?.startsWith("es") ? "es" : "en";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="display text-[44px]">Title Desk</p>
      <p className="mt-3 text-muted">{say(lang, sent ? "checkEmail" : "signInLead")}</p>
      {!sent && (
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await db.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: window.location.origin },
            });
            setBusy(false);
            if (!error) setSent(true);
          }}
        >
          <input
            className="field"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={say(lang, "email")}
          />
          <button className="primary" disabled={busy || !email.includes("@")}>
            {say(lang, "signIn")}
          </button>
        </form>
      )}
    </main>
  );
}
