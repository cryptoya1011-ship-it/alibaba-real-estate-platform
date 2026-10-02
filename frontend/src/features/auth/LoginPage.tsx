import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, CalendarClock, Handshake, LogIn, Send, ShieldCheck, Sparkles } from "lucide-react";
import { api, type AuthMethods } from "@/api";
import { useSession, type PasswordCredentials } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/components/ui/states";
import { Brand } from "@/components/layout/Brand";
import { ThemeToggle } from "@/components/layout/TopbarActions";
import { FullScreenLoader } from "@/components/layout/PageLoader";

const FEATURES = [
  { icon: Building2, text: "ثبت و مدیریت املاک با کد یکتا" },
  { icon: Handshake, text: "پایپ‌لاین معاملات و کمیسیون" },
  { icon: CalendarClock, text: "بازدیدها و اعلان‌های لحظه‌ای" },
  { icon: Sparkles, text: "جستجو و تطبیق هوشمند فارسی" },
];

// Circuit breaker: if the session keeps getting rejected right after an automatic
// login (401 → login → 401 …) stop logging in automatically and let the user
// press the button instead of bouncing between screens forever.
const AUTO_LOGIN_KEY = "arep_auto_login";
const AUTO_LOGIN_WINDOW_MS = 60_000;
const AUTO_LOGIN_MAX = 3;

function recentAutoLogins(): number[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(AUTO_LOGIN_KEY) ?? "[]") as unknown;
    const now = Date.now();
    return Array.isArray(raw) ? raw.filter((t): t is number => typeof t === "number" && now - t < AUTO_LOGIN_WINDOW_MS) : [];
  } catch {
    return [];
  }
}

function recordAutoLogin(list: number[]) {
  try {
    sessionStorage.setItem(AUTO_LOGIN_KEY, JSON.stringify([...list, Date.now()]));
  } catch {
    /* ignore */
  }
}

export function LoginPage() {
  const { status, session, login, insideTelegram, userLoggedOut } = useSession();
  const [params] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);
  const [paused, setPaused] = useState(false);
  const next = params.get("next");
  // Outside Telegram ask the server which login methods it accepts. When the
  // temporary password login is on (ADR-0023) show the form instead of the dev login.
  // If the server can't answer, keep the original flow (dev login).
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [methodsReady, setMethodsReady] = useState(insideTelegram);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const passwordMode = !insideTelegram && methods?.password === true;
  const noBrowserLogin = !insideTelegram && methods != null && !methods.password && !methods.dev;

  useEffect(() => {
    if (insideTelegram) return;
    let alive = true;
    api
      .authMethods()
      .then((m) => alive && setMethods(m))
      .catch(() => undefined)
      .finally(() => alive && setMethodsReady(true));
    return () => {
      alive = false;
    };
  }, [insideTelegram]);

  const doLogin = async (credentials?: PasswordCredentials) => {
    setBusy(true);
    setError(null);
    try {
      await login(credentials);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    void doLogin({ username: username.trim(), password });
  };

  // Auto-login once: inside Telegram (initData) or outside (dev login) — unless the user just logged out
  // or the server wants a username/password.
  useEffect(() => {
    if (!methodsReady || attempted.current || status === "authenticated") return;
    attempted.current = true;
    if (!insideTelegram && (userLoggedOut || passwordMode || noBrowserLogin)) return;
    const recent = recentAutoLogins();
    if (recent.length >= AUTO_LOGIN_MAX) {
      setPaused(true);
      return;
    }
    recordAutoLogin(recent);
    void doLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodsReady]);

  if (status === "authenticated" && session) {
    const target = next && next.startsWith("/") ? next : "/app";
    return <Navigate to={session.organization_id ? target : `/orgs${next ? `?next=${encodeURIComponent(next)}` : ""}`} replace />;
  }
  if (!methodsReady) return <FullScreenLoader label="در حال آماده‌سازی…" />;
  if (busy && !error && !userLoggedOut && !passwordMode)
    return <FullScreenLoader label={insideTelegram ? "ورود با تلگرام…" : "در حال ورود…"} />;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-hero">
      <div className="absolute end-3 top-3 pt-safe">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden flex-col gap-6 lg:flex"
        >
          <Brand />
          <h1 className="text-display-lg font-extrabold leading-[1.5] tracking-tight">
            دفتر املاک‌تان را
            <span className="bg-gradient-primary bg-clip-text text-transparent"> هوشمند </span>
            اداره کنید
          </h1>
          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-body text-muted-foreground">
                <span className="grid size-9 place-items-center rounded-[10px] bg-card text-primary hairline">
                  <f.icon className="size-[18px]" aria-hidden />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mx-auto w-full max-w-sm rounded-[24px] bg-card/90 p-6 shadow-lg backdrop-blur hairline sm:p-8"
        >
          <div className="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
            <Brand />
          </div>
          <h2 className="text-display font-bold">خوش آمدید</h2>
          <p className="mt-1 text-body text-muted-foreground">
            {insideTelegram
              ? "ورود امن با حساب تلگرام شما انجام می‌شود."
              : passwordMode
                ? "نام کاربری و رمز عبور را وارد کنید."
                : "برای ادامه وارد حساب کاربری شوید."}
          </p>

          {paused && error == null && (
            <div role="status" className="mt-5 rounded-[14px] border border-warning/25 bg-warning-soft px-3.5 py-3 text-body">
              <p className="font-semibold text-warning">ورود خودکار متوقف شد</p>
              <p className="text-caption text-muted-foreground">نشست چند بار پشت‌سرهم رد شد. برای ادامه، دکمهٔ ورود را بزنید.</p>
            </div>
          )}

          {error != null && (
            <div role="alert" className="mt-5 rounded-[14px] border border-danger/25 bg-danger-soft px-3.5 py-3 text-body">
              <p className="font-semibold text-danger">ورود ناموفق بود</p>
              <p className="text-caption text-muted-foreground">{errorMessage(error, "اتصال به سرور برقرار نشد")}</p>
            </div>
          )}

          {passwordMode ? (
            <form className="mt-6 flex flex-col gap-4" onSubmit={submitPassword} noValidate>
              <Field label="نام کاربری" required>
                {(id, d) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    ltr
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                )}
              </Field>
              <Field label="رمز عبور" required>
                {(id, d) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    ltr
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" size="lg" block loading={busy} disabled={!username.trim() || !password}>
                <LogIn aria-hidden />
                ورود
              </Button>
            </form>
          ) : noBrowserLogin ? (
            <div role="status" className="mt-6 rounded-[14px] border border-border bg-muted/40 px-3.5 py-3 text-body">
              <p className="font-semibold">ورود فقط از داخل تلگرام</p>
              <p className="text-caption text-muted-foreground">برنامه را از داخل ربات تلگرام دفتر باز کنید.</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              <Button size="lg" block onClick={() => void doLogin()} loading={busy}>
                {insideTelegram ? <Send aria-hidden /> : <LogIn aria-hidden />}
                {insideTelegram ? "ورود با تلگرام" : "ورود (حالت توسعه)"}
              </Button>
              {!insideTelegram && (
                <p className="text-center text-caption text-muted-foreground">
                  خارج از تلگرام، ورود آزمایشی با شناسه{" "}
                  <span dir="ltr" className="font-mono">
                    1000001
                  </span>{" "}
                  انجام می‌شود.
                </p>
              )}
            </div>
          )}
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4 text-caption text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            جداسازی کامل داده هر سازمان
          </div>
        </motion.div>
      </div>
    </div>
  );
}
