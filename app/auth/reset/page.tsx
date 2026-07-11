"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Logo from "@/components/Logo";
import Wordmark from "@/components/Wordmark";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "invalid" | "done";

// Landing page for the password-recovery email link.
//
// Primary path is the device-independent token-hash flow: the email template
// links to /auth/reset?token_hash=...&type=recovery, and verifyOtp() redeems
// that server-side one-time token into a session on whatever device opens it.
// This is what makes "request on desktop, click on phone" work — unlike the
// PKCE ?code= flow, which needs a code verifier stashed in the requesting
// browser's localStorage and so fails cross-device.
//
// Fallback path (no token_hash in the URL): honor an existing recovery
// session, e.g. a same-browser ?code= link the SSR client auto-exchanges via
// detectSessionInUrl. Either way the user then sets a new password through
// auth.updateUser(). Expired/used links show the invalid state with a path
// back to requesting a fresh one.
export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  // Same per-render construction as app/auth/page.tsx — createBrowserClient
  // returns a cached singleton, so this doesn't spawn a client per render.
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  useEffect(() => {
    let settled = false;
    const finish = (next: Phase) => {
      if (settled) return;
      settled = true;
      setPhase(next);
    };

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    // A used/expired link arrives as #error=...&error_code=otp_expired — no
    // session will ever materialize, so fail fast before anything else.
    if (window.location.hash.includes("error=")) {
      finish("invalid");
      return;
    }

    if (tokenHash) {
      // Device-independent path: redeem the one-time recovery token into a
      // session here, regardless of which browser opened the email.
      supabase.auth
        .verifyOtp({ type: (type as "recovery") || "recovery", token_hash: tokenHash })
        .then(({ error }) => finish(error ? "invalid" : "ready"));
      return;
    }

    // Fallback: same-browser ?code= links, which the SSR client exchanges
    // automatically (detectSessionInUrl) and surfaces via onAuthStateChange
    // or an already-present session.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        finish("ready");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish("ready");
    });

    // The code exchange is a network round-trip; if no session shows up within
    // a generous window, the link is bad (or a PKCE link opened in a browser
    // other than the one that requested it).
    const timer = setTimeout(() => finish("invalid"), 5000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  function validationError(): string {
    if (!password) return t("errors.passwordRequired");
    if (password.length < 8) return t("errors.passwordMin");
    if (!confirm) return t("errors.confirmRequired");
    if (confirm !== password) return t("errors.passwordMismatch");
    return "";
  }

  async function submit() {
    setTouched(true);
    if (validationError()) return;

    setSaving(true);
    setErrorBanner("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    setPhase("done");
  }

  const labelClass = "mb-1.5 block font-label text-[13px] font-semibold text-neutral-700";
  const errorTextClass = "mt-1.5 text-[12.5px] text-danger-500";
  const passwordBoxClass = "flex h-[46px] items-center rounded-[10px] border border-neutral-300 bg-white pe-1.5";
  const passwordInputClass =
    "h-full min-w-0 flex-1 border-none bg-transparent px-3.5 font-body text-sm text-neutral-900 outline-none";

  return (
    <div className="flex min-h-screen flex-col bg-tertiary-100">
      <header className="flex justify-center px-5 pt-5">
        <a onClick={() => router.push("/")} className="flex cursor-pointer items-center gap-2.5 no-underline">
          <Logo size={34} priority />
          <Wordmark size={18} />
        </a>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="w-full max-w-[460px] rounded-[28px] bg-white p-7 shadow-lg sm:p-10">
          {phase === "checking" && (
            <div className="py-6 text-center text-sm text-neutral-500">{t("checkingLink")}</div>
          )}

          {phase === "invalid" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-[10px] border border-danger-50 bg-danger-50 px-3.5 py-3 text-[13px] leading-snug text-danger-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("resetInvalidHint")}</span>
              </div>
              <Button variant="primary" size="lg" fullWidth onClick={() => router.push("/auth")}>
                {t("requestNewLink")}
              </Button>
            </div>
          )}

          {phase === "ready" && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-headline text-xl font-extrabold text-neutral-900">{t("resetTitle")}</div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">{t("resetHint")}</p>
              </div>

              {errorBanner && (
                <div className="flex items-start gap-2 rounded-[10px] border border-danger-50 bg-danger-50 px-3.5 py-3 text-[13px] leading-snug text-danger-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorBanner}</span>
                </div>
              )}

              <div>
                <label className={labelClass}>{t("newPassword")}</label>
                <div className={passwordBoxClass}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setTouched(true);
                      setErrorBanner("");
                    }}
                    placeholder={t("newPasswordPlaceholder")}
                    className={passwordInputClass}
                  />
                  <button
                    type="button"
                    aria-label={t("togglePassword")}
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-neutral-500"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>{t("confirmPassword")}</label>
                <div className={passwordBoxClass}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setTouched(true);
                      setErrorBanner("");
                    }}
                    placeholder={t("confirmPasswordPlaceholder")}
                    className={passwordInputClass}
                  />
                  <button
                    type="button"
                    aria-label={t("togglePassword")}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-neutral-500"
                  >
                    {showConfirm ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {touched && validationError() && <div className={errorTextClass}>{validationError()}</div>}
              </div>

              <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={saving}>
                {saving ? t("updatingPassword") : t("updatePassword")}
              </Button>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-secondary-50">
                <Check className="h-[30px] w-[30px] text-secondary-600" />
              </span>
              <div className="font-headline text-xl font-extrabold text-neutral-900">{t("resetSuccessTitle")}</div>
              <p className="m-0 max-w-[320px] text-[13.5px] text-neutral-500">{t("resetSuccessHint")}</p>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
              >
                {t("resetContinue")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
