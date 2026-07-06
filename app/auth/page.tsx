"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ShieldCheck,
  Truck,
  Headset,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,}$/;

const SIDE_PANEL_ITEMS = [
  { Icon: ShieldCheck, text: "100% genuine medicines from a licensed pharmacy" },
  { Icon: Truck, text: "2-hour delivery across Greater Cairo" },
  { Icon: Headset, text: "A licensed pharmacist a tap away, 24/7" },
];

type View = "signin" | "signup";

interface SignInState {
  emailOrPhone: string;
  password: string;
}

interface SignUpState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  agree: boolean;
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  // Only allow same-origin path redirects — a raw router.push() of the query
  // param would let /auth?redirect=https://evil.com (or //evil.com) send a
  // freshly signed-in user to an external site (open redirect).
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/\\")
    ? rawRedirect
    : "/";

  const [view, setView] = useState<View>("signin");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  const [si, setSi] = useState<SignInState>({ emailOrPhone: "", password: "" });
  const [siTouched, setSiTouched] = useState<Partial<Record<keyof SignInState, boolean>>>({});
  const [siShowPassword, setSiShowPassword] = useState(false);

  const [su, setSu] = useState<SignUpState>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    agree: false,
  });
  const [suTouched, setSuTouched] = useState<Partial<Record<keyof SignUpState, boolean>>>({});
  const [suShowPassword, setSuShowPassword] = useState(false);
  const [suShowConfirm, setSuShowConfirm] = useState(false);

  function validateSi(state: SignInState) {
    const errors: Partial<Record<keyof SignInState, string>> = {};
    const v = state.emailOrPhone.trim();
    if (!v) errors.emailOrPhone = "Email or phone number is required";
    else if (v.includes("@") && !EMAIL_RE.test(v)) errors.emailOrPhone = "Enter a valid email address";
    else if (!v.includes("@") && !PHONE_RE.test(v)) errors.emailOrPhone = "Enter a valid phone number";
    if (!state.password) errors.password = "Password is required";
    else if (state.password.length < 8) errors.password = "Password must be at least 8 characters";
    return errors;
  }

  function validateSu(state: SignUpState) {
    const errors: Partial<Record<keyof SignUpState, string>> = {};
    if (!state.fullName.trim()) errors.fullName = "Full name is required";
    if (!state.email.trim()) errors.email = "Email is required";
    else if (!EMAIL_RE.test(state.email.trim())) errors.email = "Enter a valid email address";
    if (!state.phone.trim()) errors.phone = "Phone number is required";
    else if (!PHONE_RE.test(state.phone.trim())) errors.phone = "Enter a valid phone number";
    if (!state.password) errors.password = "Password is required";
    else if (state.password.length < 8) errors.password = "Password must be at least 8 characters";
    if (!state.confirm) errors.confirm = "Please confirm your password";
    else if (state.confirm !== state.password) errors.confirm = "Passwords don’t match";
    if (!state.agree) errors.agree = "You must agree to the Terms & Privacy Policy";
    return errors;
  }

  const siErrorsAll = validateSi(si);
  const siErrors: Partial<Record<keyof SignInState, string>> = {};
  (Object.keys(siErrorsAll) as (keyof SignInState)[]).forEach((k) => {
    if (siTouched[k]) siErrors[k] = siErrorsAll[k];
  });

  const suErrorsAll = validateSu(su);
  const suErrors: Partial<Record<keyof SignUpState, string>> = {};
  (Object.keys(suErrorsAll) as (keyof SignUpState)[]).forEach((k) => {
    if (suTouched[k]) suErrors[k] = suErrorsAll[k];
  });

  async function submitSignIn() {
    const errors = validateSi(si);
    setSiTouched({ emailOrPhone: true, password: true });
    if (Object.keys(errors).length) return;

    setLoading(true);
    setErrorBanner("");
    const { error } = await supabase.auth.signInWithPassword({
      email: si.emailOrPhone.trim(),
      password: si.password,
    });
    setLoading(false);
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function submitSignUp() {
    const errors = validateSu(su);
    setSuTouched({
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirm: true,
      agree: true,
    });
    if (Object.keys(errors).length) return;

    setLoading(true);
    setErrorBanner("");
    const { error } = await supabase.auth.signUp({
      email: su.email.trim(),
      password: su.password,
      options: {
        data: { full_name: su.fullName.trim(), phone: su.phone.trim() },
      },
    });
    setLoading(false);
    if (error) {
      setErrorBanner(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  function goHome() {
    router.push("/");
  }

  const isSignIn = view === "signin";

  const tabActive =
    "flex-1 rounded-full py-2.5 font-label text-[13.5px] font-bold bg-white text-neutral-900 shadow-sm";
  const tabInactive =
    "flex-1 rounded-full py-2.5 font-label text-[13.5px] font-bold bg-transparent text-neutral-500";
  const labelClass = "mb-1.5 block font-label text-[13px] font-semibold text-neutral-700";
  const errorTextClass = "mt-1.5 text-[12.5px] text-danger-500";

  return (
    <div className="flex min-h-screen flex-col bg-tertiary-100">
      <header className="flex justify-center px-5 pt-5">
        <a
          onClick={goHome}
          className="flex cursor-pointer items-center gap-2.5 no-underline"
        >
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary-500 shadow-[0_6px_18px_rgba(15,82,255,0.28)]">
            <Plus className="h-[19px] w-[19px] text-white" />
          </span>
          <span className="whitespace-nowrap font-headline text-lg font-extrabold tracking-tight text-neutral-900">
            Elshabrawy <span className="text-primary-500">Pharmacy</span>
          </span>
        </a>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] shadow-lg md:flex-row">
          <div className="hidden min-w-[260px] max-w-[340px] flex-1 flex-col justify-center gap-[22px] rounded-l-[28px] bg-gradient-to-br from-primary-600 to-secondary-600 p-8 text-white md:flex">
            <div className="font-headline text-2xl font-extrabold leading-tight tracking-tight">
              Trusted by thousands of customers across Cairo
            </div>
            <div className="flex flex-col gap-4">
              {SIDE_PANEL_ITEMS.map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-white/15">
                    <Icon className="h-[19px] w-[19px] text-white" />
                  </span>
                  <span className="text-sm leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 basis-[460px] rounded-[28px] bg-white p-7 sm:p-10 md:rounded-l-none md:rounded-r-[28px]">
            <div className="flex flex-col gap-[22px]">
              <div className="flex rounded-full bg-neutral-100 p-1">
                <button onClick={() => { setView("signin"); setErrorBanner(""); }} className={isSignIn ? tabActive : tabInactive}>
                  Sign in
                </button>
                <button onClick={() => { setView("signup"); setErrorBanner(""); }} className={!isSignIn ? tabActive : tabInactive}>
                  Sign up
                </button>
              </div>

              {errorBanner && (
                <div className="flex items-start gap-2 rounded-[10px] border border-danger-50 bg-danger-50 px-3.5 py-3 text-[13px] leading-snug text-danger-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorBanner}</span>
                </div>
              )}

              {isSignIn ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelClass}>Email or phone number</label>
                    <Input
                      placeholder="you@example.com"
                      value={si.emailOrPhone}
                      onChange={(e) => {
                        setSi((s) => ({ ...s, emailOrPhone: e.target.value }));
                        setSiTouched((t) => ({ ...t, emailOrPhone: true }));
                        setErrorBanner("");
                      }}
                    />
                    {siErrors.emailOrPhone && <div className={errorTextClass}>{siErrors.emailOrPhone}</div>}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={labelClass}>Password</label>
                      <a className="cursor-pointer text-[12.5px] font-semibold text-primary-500 no-underline">
                        Forgot password?
                      </a>
                    </div>
                    <div className="flex h-[46px] items-center rounded-[10px] border border-neutral-300 bg-white pr-1.5">
                      <input
                        type={siShowPassword ? "text" : "password"}
                        value={si.password}
                        onChange={(e) => {
                          setSi((s) => ({ ...s, password: e.target.value }));
                          setSiTouched((t) => ({ ...t, password: true }));
                          setErrorBanner("");
                        }}
                        placeholder="Enter your password"
                        className="h-full min-w-0 flex-1 border-none bg-transparent px-3.5 font-body text-sm text-neutral-900 outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Toggle password visibility"
                        onClick={() => setSiShowPassword((v) => !v)}
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-neutral-500"
                      >
                        {siShowPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {siErrors.password && <div className={errorTextClass}>{siErrors.password}</div>}
                  </div>

                  <Button variant="primary" size="lg" fullWidth onClick={submitSignIn} disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-neutral-200" />
                    <span className="text-xs text-neutral-400">or continue with</span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </div>

                  <Button variant="outlined" size="lg" fullWidth>
                    <Globe className="h-[18px] w-[18px]" /> Continue with Google
                  </Button>

                  <div className="text-center text-[13.5px] text-neutral-500">
                    Don&apos;t have an account?{" "}
                    <a onClick={() => setView("signup")} className="cursor-pointer font-bold text-primary-500 no-underline">
                      Sign up
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelClass}>Full name</label>
                    <Input
                      placeholder="Sara Ahmed"
                      value={su.fullName}
                      onChange={(e) => {
                        setSu((s) => ({ ...s, fullName: e.target.value }));
                        setSuTouched((t) => ({ ...t, fullName: true }));
                      }}
                    />
                    {suErrors.fullName && <div className={errorTextClass}>{suErrors.fullName}</div>}
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <Input
                      placeholder="you@example.com"
                      value={su.email}
                      onChange={(e) => {
                        setSu((s) => ({ ...s, email: e.target.value }));
                        setSuTouched((t) => ({ ...t, email: true }));
                      }}
                    />
                    {suErrors.email && <div className={errorTextClass}>{suErrors.email}</div>}
                  </div>
                  <div>
                    <label className={labelClass}>Phone number</label>
                    <Input
                      placeholder="+20 100 123 4567"
                      value={su.phone}
                      onChange={(e) => {
                        setSu((s) => ({ ...s, phone: e.target.value }));
                        setSuTouched((t) => ({ ...t, phone: true }));
                      }}
                    />
                    {suErrors.phone && <div className={errorTextClass}>{suErrors.phone}</div>}
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="flex h-[46px] items-center rounded-[10px] border border-neutral-300 bg-white pr-1.5">
                      <input
                        type={suShowPassword ? "text" : "password"}
                        value={su.password}
                        onChange={(e) => {
                          setSu((s) => ({ ...s, password: e.target.value }));
                          setSuTouched((t) => ({ ...t, password: true }));
                        }}
                        placeholder="At least 8 characters"
                        className="h-full min-w-0 flex-1 border-none bg-transparent px-3.5 font-body text-sm text-neutral-900 outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Toggle password visibility"
                        onClick={() => setSuShowPassword((v) => !v)}
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-neutral-500"
                      >
                        {suShowPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {suErrors.password && <div className={errorTextClass}>{suErrors.password}</div>}
                  </div>
                  <div>
                    <label className={labelClass}>Confirm password</label>
                    <div className="flex h-[46px] items-center rounded-[10px] border border-neutral-300 bg-white pr-1.5">
                      <input
                        type={suShowConfirm ? "text" : "password"}
                        value={su.confirm}
                        onChange={(e) => {
                          setSu((s) => ({ ...s, confirm: e.target.value }));
                          setSuTouched((t) => ({ ...t, confirm: true }));
                        }}
                        placeholder="Re-enter your password"
                        className="h-full min-w-0 flex-1 border-none bg-transparent px-3.5 font-body text-sm text-neutral-900 outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Toggle password visibility"
                        onClick={() => setSuShowConfirm((v) => !v)}
                        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-neutral-500"
                      >
                        {suShowConfirm ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                    {suErrors.confirm && <div className={errorTextClass}>{suErrors.confirm}</div>}
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={su.agree}
                      onChange={() => {
                        setSu((s) => ({ ...s, agree: !s.agree }));
                        setSuTouched((t) => ({ ...t, agree: true }));
                      }}
                      className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer"
                    />
                    <span className="text-[13px] leading-snug text-neutral-700">
                      I agree to the{" "}
                      <a className="font-semibold text-primary-500 no-underline">Terms of Service</a> and{" "}
                      <a className="font-semibold text-primary-500 no-underline">Privacy Policy</a>
                    </span>
                  </label>
                  {suErrors.agree && <div className={errorTextClass}>{suErrors.agree}</div>}

                  <Button variant="primary" size="lg" fullWidth onClick={submitSignUp} disabled={loading}>
                    {loading ? "Creating account…" : "Create account"}
                  </Button>

                  <div className="text-center text-[13.5px] text-neutral-500">
                    Already have an account?{" "}
                    <a onClick={() => setView("signin")} className="cursor-pointer font-bold text-primary-500 no-underline">
                      Sign in
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
