import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, CalendarClock, Handshake, LogIn, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
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

export function LoginPage() {
  const { status, session, login, insideTelegram, userLoggedOut } = useSession();
  const [params] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);
  const next = params.get("next");

  const doLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await login();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Auto-login once: inside Telegram (initData) or outside (dev login) — unless the user just logged out.
  useEffect(() => {
    if (attempted.current || status === "authenticated") return;
    attempted.current = true;
    if (insideTelegram || !userLoggedOut) void doLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "authenticated" && session) {
    const target = next && next.startsWith("/") ? next : "/app";
    return <Navigate to={session.organization_id ? target : `/orgs${next ? `?next=${encodeURIComponent(next)}` : ""}`} replace />;
  }
  if (busy && !error && !userLoggedOut) return <FullScreenLoader label={insideTelegram ? "ورود با تلگرام…" : "در حال ورود…"} />;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-hero">
      <div className="absolute end-3 top-3 pt-safe">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-12 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="hidden flex-col gap-6 lg:flex">
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
            {insideTelegram ? "ورود امن با حساب تلگرام شما انجام می‌شود." : "برای ادامه وارد حساب کاربری شوید."}
          </p>

          {error != null && (
            <div role="alert" className="mt-5 rounded-[14px] border border-danger/25 bg-danger-soft px-3.5 py-3 text-body">
              <p className="font-semibold text-danger">ورود ناموفق بود</p>
              <p className="text-caption text-muted-foreground">{errorMessage(error, "اتصال به سرور برقرار نشد")}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" block onClick={doLogin} loading={busy}>
              {insideTelegram ? <Send aria-hidden /> : <LogIn aria-hidden />}
              {insideTelegram ? "ورود با تلگرام" : "ورود (حالت توسعه)"}
            </Button>
            {!insideTelegram && (
              <p className="text-center text-caption text-muted-foreground">
                خارج از تلگرام، ورود آزمایشی با شناسه <span dir="ltr" className="font-mono">1000001</span> انجام می‌شود.
              </p>
            )}
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4 text-caption text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            جداسازی کامل داده هر سازمان
          </div>
        </motion.div>
      </div>
    </div>
  );
}
