import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Car,
  Copy,
  Layers,
  MapPin,
  Mountain,
  PhoneCall,
  Ruler,
  Send,
  ShieldCheck,
  Share2,
  Tag,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "../api";
import { faDate, faNum, toman, PROPERTY_TYPE_FA, TRANSACTION_TYPE_FA } from "../lib/format";
import { isOnline } from "../pwa";
import type { PublicProperty } from "../lib/types";
import { Card, EmptyState, Logo, Skeleton } from "../components/ui";

export default function PublicPropertyPage() {
  const { code } = useParams<{ code: string }>();
  const [detail, setDetail] = useState<PublicProperty | null>(null);
  const [others, setOthers] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const online = isOnline();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (code) {
          const d = (await api.publicGetByCode(code)) as PublicProperty;
          setDetail(d);
          document.title = `${d.title} — املاک علی‌بابا`;
          const setMeta = (selector: string, value: string) => {
            const el = document.querySelector(selector);
            if (el) el.setAttribute("content", value);
          };
          setMeta('meta[name="description"]', d.description?.slice(0, 160) || d.title);
          setMeta('meta[property="og:title"]', d.title);
          setMeta('meta[property="og:description"]', d.description?.slice(0, 160) || "املاک علی‌بابا");
          if (d.primary_image) setMeta('meta[property="og:image"]', d.primary_image);
        }
      } catch {
        setDetail(null);
      }
      try {
        const list = (await api.publicListProperties({ limit: 50 })) as PublicProperty[];
        setOthers(list.filter((p) => p.code !== code).slice(0, 4));
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [code]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <a href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <div className="leading-tight">
              <div className="text-[13px] font-bold">املاک علی‌بابا</div>
              <div className="text-[9px] text-muted">صفحه عمومی ملک</div>
            </div>
          </a>
          <div className="flex-1" />
          {!online && (
            <span className="flex items-center gap-1 rounded-full bg-warn/10 px-2.5 py-1 text-[10px] text-warn">
              <WifiOff className="h-3 w-3" />
              آفلاین
            </span>
          )}
          <a
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line px-3 text-[11px] font-medium transition hover:bg-raise"
          >
            ورود به اپ
            <ArrowRight className="h-3 w-3 rotate-180" />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !detail ? (
          <Card className="p-8">
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="ملک پیدا نشد یا منتشر نشده است"
              desc={`کد درخواستی: ${code ?? "—"} — فقط املاک منتشرشده در دسترس عمومی هستند.`}
            />
          </Card>
        ) : (
          <article className="animate-fade-in">
            {/* Hero */}
            <div className="relative mb-4 overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
              {detail.primary_image ? (
                <img src={detail.primary_image} alt={detail.title} className="h-64 w-full object-cover sm:h-80" />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-brand/20 via-brand/10 to-gold/10 sm:h-64">
                  <Building2 className="h-16 w-16 text-brand/60" />
                </div>
              )}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                    {PROPERTY_TYPE_FA[detail.property_type] ?? detail.property_type}
                  </span>
                  <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                    {TRANSACTION_TYPE_FA[detail.transaction_type] ?? detail.transaction_type}
                  </span>
                </div>
                <span className="ltr rounded-full bg-black/45 px-2.5 py-1 font-mono text-[10px] text-white backdrop-blur" dir="ltr">
                  {detail.code}
                </span>
              </div>
            </div>

            {/* Title + price */}
            <Card className="mb-3 p-5">
              <h1 className="text-lg font-bold leading-8 sm:text-xl">{detail.title}</h1>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="text-xl font-black text-gold sm:text-2xl">{toman(detail.price)}</div>
                {detail.built_area && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-raise px-3 py-2 text-xs">
                    <Ruler className="h-3.5 w-3.5 text-brand" />
                    <span className="tnum font-bold">{faNum(detail.built_area)}</span>
                    <span className="text-muted">متر مربع</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
                {detail.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {detail.city} {detail.district ? `• ${detail.district}` : ""}
                  </span>
                )}
                <span>ثبت: {faDate(detail.created_at)}</span>
              </div>
            </Card>

            {/* Description */}
            <Card className="mb-3 p-5">
              <h2 className="mb-2 text-sm font-bold">توضیحات</h2>
              <p className="whitespace-pre-line text-xs leading-7 text-ink/90">{detail.description || "توضیحی برای این ملک ثبت نشده است."}</p>
            </Card>

            {/* Features / specs */}
            <Card className="mb-3 p-5">
              <h2 className="mb-3 text-sm font-bold">مشخصات</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Spec icon={<Tag className="h-3.5 w-3.5" />} label="نوع" value={PROPERTY_TYPE_FA[detail.property_type] ?? detail.property_type} />
                <Spec icon={<Layers className="h-3.5 w-3.5" />} label="معامله" value={TRANSACTION_TYPE_FA[detail.transaction_type] ?? detail.transaction_type} />
                <Spec icon={<Ruler className="h-3.5 w-3.5" />} label="متراژ" value={detail.built_area ? `${faNum(detail.built_area)} م²` : "—"} />
                <Spec icon={<MapPin className="h-3.5 w-3.5" />} label="محله" value={detail.district ?? "—"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["پارکینگ", "آسانسور", "انباری", "بالکن"].map((f, i) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-full bg-raise px-2.5 py-1 text-[10px] text-muted">
                    {i === 0 ? <Car className="h-3 w-3" /> : i === 1 ? <Mountain className="h-3 w-3" /> : null}
                    {f}
                  </span>
                ))}
              </div>
            </Card>

            {/* Share / contact */}
            <Card className="mb-5 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Share2 className="h-4 w-4 text-brand" />
                اشتراک‌گذاری و ارتباط
              </h2>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(detail.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-white transition hover:brightness-110 dark:text-slate-900"
                >
                  <Send className="h-4 w-4" />
                  ارسال در تلگرام
                </a>
                <button
                  onClick={copyLink}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 text-xs font-medium transition hover:bg-raise"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "کپی شد ✓" : "کپی لینک"}
                </button>
                <a
                  href="tel:+982100000000"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-4 text-xs font-medium transition hover:bg-raise"
                >
                  <PhoneCall className="h-4 w-4" />
                  تماس با مشاور
                </a>
              </div>
              <p className="mt-3 text-[10px] leading-5 text-muted">
                این صفحه بدون نیاز به ورود قابل مشاهده است — با اشتراک‌گذاری لینک، تصویر و عنوان ملک به‌صورت خودکار در شبکه‌های اجتماعی نمایش داده می‌شود.
              </p>
            </Card>

            {/* Other properties */}
            {others.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold">سایر املاک منتشرشده</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {others.map((p) => (
                    <li key={p.id}>
                      <a href={`/p/${p.code}`} className="block">
                        <Card className="flex gap-3 p-3 transition hover:border-brand/40">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-raise">
                            {p.primary_image ? (
                              <img src={p.primary_image} alt={p.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted">
                                <Building2 className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-bold">{p.title}</div>
                            <div className="mt-1 truncate text-[10px] text-muted">
                              {p.city} {p.district ? `• ${p.district}` : ""}
                            </div>
                            <div className="tnum mt-1 text-[11px] font-bold text-gold">{toman(p.price)}</div>
                          </div>
                        </Card>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </main>

      <footer className="border-t border-line py-6 text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 text-[10px] text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            املاک علی‌بابا — پلتفرم مدیریت املاک چند‌سازمانی
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              {online ? <Wifi className="h-3 w-3 text-ok" /> : <WifiOff className="h-3 w-3 text-warn" />}
              {online ? "آنلاین" : "آفلاین — نمایش از کش"}
            </span>
            <span>•</span>
            <span>PWA قابل نصب</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-raise p-2.5">
      <div className="flex items-center gap-1 text-[9px] text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-[11px] font-bold">{value}</div>
    </div>
  );
}
