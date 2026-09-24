import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CreditCard,
  Hash,
  Map as MapIcon,
  MessageCircle,
  Newspaper,
  Plug,
  RefreshCw,
  Send,
  Smartphone,
} from "lucide-react";
import { ApiError, api } from "../api";
import { faDateTime, faNum } from "../lib/format";
import type { PropertyListItem } from "../lib/types";
import { useData } from "../state/data";
import { Badge, Button, Card, Code, EmptyState, Field, Input, ListSkeleton, PageHead, Select, Textarea } from "../components/ui";
import { toast } from "sonner";

type Providers = {
  current: Record<string, string | string[]>;
  available: Record<string, string[]>;
  details: Record<string, { provider: string; has_key: boolean }>;
};

type ResultRow = Record<string, unknown> & { provider?: string; success?: boolean; url?: string; payment_url?: string };

type LogRow = {
  id: number;
  provider: string;
  action: string;
  status: string;
  entity_type?: string | null;
  entity_id?: number | null;
  external_id?: string | null;
  external_url?: string | null;
  error_message?: string | null;
  created_at?: string;
};

const TABS = [
  { key: "telegram", label: "تلگرام", icon: <Send className="h-3.5 w-3.5" /> },
  { key: "sms", label: "پیامک", icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: "listings", label: "آگهی", icon: <Newspaper className="h-3.5 w-3.5" /> },
  { key: "payment", label: "پرداخت", icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: "maps", label: "نقشه", icon: <MapIcon className="h-3.5 w-3.5" /> },
  { key: "logs", label: "لاگ‌ها", icon: <Activity className="h-3.5 w-3.5" /> },
] as const;

export default function IntegrationsPage() {
  const { properties } = useData();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("telegram");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [chatId, setChatId] = useState("123456");
  const [tgText, setTgText] = useState("سلام از املاک علی‌بابا 🏠");
  const [tgProperty, setTgProperty] = useState("");
  const [phone, setPhone] = useState("09130000000");
  const [smsText, setSmsText] = useState("کد تأیید شما: 123456");
  const [smsMode, setSmsMode] = useState<"send" | "otp">("send");
  const [publishPlatform, setPublishPlatform] = useState("divar");
  const [publishProperty, setPublishProperty] = useState("");
  const [amount, setAmount] = useState(500_000);
  const [payDesc, setPayDesc] = useState("کمیسیون معامله");
  const [address, setAddress] = useState("اصفهان، مرداویج، خیابان آزادی");
  const [geo, setGeo] = useState<{ lat: number; lng: number; city?: string; address?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setProviders(await api.intListProviders());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      setLogs((await api.intListLogs({ limit: 25 })) as LogRow[]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در بارگیری لاگ");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadLogs();
  }, [load, loadLogs]);

  const push = (res: ResultRow) => setResults((prev) => [res, ...prev].slice(0, 20));

  const run = async (key: string, fn: () => Promise<ResultRow>, okMsg: string) => {
    setBusy(key);
    try {
      const res = await fn();
      push(res);
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در فراخوانی سرویس");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHead
        title="یکپارچه‌سازی"
        desc="Telegram • SMS • Divar/Sheypoor • Payment • OpenStreetMap — هر Adapter مستقل، بدون Vendor Lock-in"
        icon={<Plug className="h-5 w-5" />}
         action={
          <Button size="sm" variant="outline" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => { load(); loadLogs(); }}>
            تازه‌سازی
          </Button>
        }
      />

      {/* Provider status */}
      {providers && (
        <Card className="mb-4 p-4">
          <div className="mb-2 text-xs font-bold">وضعیت ارائه‌دهندگان</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(providers.details ?? {}).map(([k, v]) => (
              <span
                key={k}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  v.has_key ? "bg-ok/15 text-ok" : "bg-raise text-muted"
                }`}
              >
                <span className="ltr font-mono" dir="ltr">
                  {k}
                </span>
                <span className="opacity-80">{v.provider}</span>
                <span>{v.has_key ? "🔑✓" : "🔑✗"}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="scrollbar-none mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition ${
              tab === t.key ? "bg-brand text-white shadow-sm dark:text-slate-900" : "bg-raise text-muted hover:text-ink"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "telegram" && (
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Send className="h-4 w-4 text-brand" />
            ارسال پیام تلگرام
          </h2>
          <Field label="شناسه گفتگو (chat_id)">
            <Input value={chatId} onChange={(e) => setChatId(e.target.value)} dir="ltr" className="font-mono" placeholder="123456 یا @username" />
          </Field>
          <Field label="متن پیام">
            <Textarea value={tgText} onChange={(e) => setTgText(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy === "tg"}
              icon={<Send className="h-3.5 w-3.5" />}
              onClick={() => run("tg", () => api.intTelegramSend(chatId, tgText), "پیام ارسال شد")}
            >
              ارسال پیام
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Hash className="h-3.5 w-3.5" />}
              loading={busy === "deep"}
              onClick={() => run("deep", () => api.intTelegramDeepLink(`prop_${Date.now()}`), "لینک ساخته شد")}
            >
              ساخت Deep Link
            </Button>
          </div>
          <div className="border-t border-line pt-4">
            <Field label="ارسال کارت ملک به تلگرام">
              <div className="flex gap-2">
                <Select value={tgProperty} onChange={(e) => setTgProperty(e.target.value)} className="flex-1">
                  <option value="">— انتخاب ملک —</option>
                  {properties.map((p: PropertyListItem) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.code})
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={!tgProperty}
                  loading={busy === "tgprop"}
                  onClick={() => run("tgprop", () => api.intTelegramSendProperty(Number(tgProperty), chatId), "کارت ملک ارسال شد")}
                >
                  ارسال
                </Button>
              </div>
            </Field>
          </div>
        </Card>
      )}

      {tab === "sms" && (
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Smartphone className="h-4 w-4 text-brand" />
            پیامک (Kavenegar / Mock)
          </h2>
          <Field label="شماره موبایل">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="font-mono" />
          </Field>
          <div className="flex gap-1.5">
            {(["send", "otp"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSmsMode(m)}
                className={`flex-1 rounded-xl border py-2 text-[11px] font-medium transition ${
                  smsMode === m ? "border-brand/50 bg-brand-soft text-brand dark:text-teal-200" : "border-line text-muted"
                }`}
              >
                {m === "send" ? "پیام معمولی" : "کد یک‌بارمصرف (OTP)"}
              </button>
            ))}
          </div>
          {smsMode === "send" && (
            <Field label="متن پیامک">
              <Textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} />
            </Field>
          )}
          <Button
            className="w-full"
            loading={busy === "sms"}
            onClick={() =>
              smsMode === "send"
                ? run("sms", () => api.intSmsSend(phone, smsText), "پیامک ارسال شد")
                : run("sms", () => api.intSmsOtp(phone), "کد یک‌بارمصرف ارسال شد")
            }
          >
            {smsMode === "send" ? "ارسال پیامک" : "ارسال کد OTP"}
          </Button>
        </Card>
      )}

      {tab === "listings" && (
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Newspaper className="h-4 w-4 text-brand" />
            انتشار آگهی در پلتفرم‌های بیرونی
          </h2>
          <Field label="پلتفرم">
            <Select value={publishPlatform} onChange={(e) => setPublishPlatform(e.target.value)}>
              <option value="divar">دیوار</option>
              <option value="sheypoor">شیپور</option>
            </Select>
          </Field>
          <Field label="ملک">
            <Select value={publishProperty} onChange={(e) => setPublishProperty(e.target.value)}>
              <option value="">— انتخاب ملک —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.code})
                </option>
              ))}
            </Select>
          </Field>
          <Button
            className="w-full"
            disabled={!publishProperty}
            loading={busy === "pub"}
            onClick={() => run("pub", () => api.intPublishListing(publishPlatform, Number(publishProperty)), "آگهی منتشر شد")}
          >
            انتشار آگهی
          </Button>
        </Card>
      )}

      {tab === "payment" && (
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <CreditCard className="h-4 w-4 text-brand" />
            ایجاد لینک پرداخت
          </h2>
          <Field label="مبلغ (تومان)">
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} dir="ltr" />
          </Field>
          <Field label="توضیح">
            <Input value={payDesc} onChange={(e) => setPayDesc(e.target.value)} />
          </Field>
          <Button className="w-full" loading={busy === "pay"} onClick={() => run("pay", () => api.intCreatePayment(amount, payDesc), "لینک پرداخت ساخته شد")}>
            ایجاد لینک پرداخت
          </Button>
        </Card>
      )}

      {tab === "maps" && (
        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <MapIcon className="h-4 w-4 text-brand" />
            نقشه — OpenStreetMap
          </h2>
          <Field label="آدرس">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy === "geo"}
              onClick={() =>
                run(
                  "geo",
                  async () => {
                    const res = await api.intGeocode(address);
                    setGeo(res);
                    return res;
                  },
                  "موقعیت پیدا شد",
                )
              }
            >
              کدگذاری آدرس
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={busy === "dist"}
              onClick={() => run("dist", () => api.intDistance(32.65, 51.66, 35.68, 51.41), "فاصله محاسبه شد")}
            >
              فاصله اصفهان ↔ تهران
            </Button>
          </div>
          {geo && (
            <div className="rounded-xl border border-line bg-raise p-3 text-[11px] animate-fade-in">
              <div className="tnum flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  عرض: <b dir="ltr">{geo.lat}</b>
                </span>
                <span>
                  طول: <b dir="ltr">{geo.lng}</b>
                </span>
                {geo.city && <span>شهر: <b>{geo.city}</b></span>}
              </div>
              {geo.address && <div className="mt-1 text-muted">{geo.address}</div>}
              <a
                href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=15/${geo.lat}/${geo.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-lg border border-line px-2.5 py-1 text-[10px] transition hover:bg-surface"
              >
                مشاهده در OpenStreetMap ↗
              </a>
            </div>
          )}
        </Card>
      )}

      {tab === "logs" && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Activity className="h-4 w-4 text-brand" />
              لاگ فراخوانی‌ها (tenant-aware + RLS)
            </h2>
            <Button size="xs" variant="outline" onClick={loadLogs} loading={logsLoading}>
              بارگذاری
            </Button>
          </div>
          {logsLoading && logs.length === 0 ? (
            <ListSkeleton />
          ) : logs.length === 0 ? (
            <EmptyState icon={<Activity className="h-6 w-6" />} title="لاگی ثبت نشده" desc="با اولین فراخوانی سرویس، لاگ اینجا نمایش داده می‌شود." />
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li key={log.id} className={`rounded-xl border p-3 text-[10px] ${log.status === "success" ? "border-line bg-raise/50" : "border-danger/25 bg-danger/5"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="ltr font-mono text-muted" dir="ltr">
                        #{log.id}
                      </span>
                      <Badge tone={log.status === "success" ? "ok" : "danger"}>{log.provider}</Badge>
                      <span>{log.action}</span>
                      {log.entity_type && (
                        <span className="text-muted">
                          {log.entity_type}#{log.entity_id}
                        </span>
                      )}
                    </div>
                    <span className="text-muted">{faDateTime(log.created_at)}</span>
                  </div>
                  {log.external_id && <div className="ltr mt-1 font-mono text-[9px] text-muted" dir="ltr">external_id: {log.external_id}</div>}
                  {log.external_url && (
                    <a href={log.external_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-brand hover:underline dark:text-teal-300">
                      {log.external_url}
                    </a>
                  )}
                  {log.error_message && <div className="mt-1 text-danger">خطا: {log.error_message}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Results feed */}
      {results.length > 0 && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">نتایج اخیر ({faNum(results.length)})</h2>
            <Button size="xs" variant="ghost" onClick={() => setResults([])}>
              پاک کردن
            </Button>
          </div>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className={`rounded-xl border p-3 text-[10px] animate-slide-up ${r.success === false ? "border-danger/25 bg-danger/5" : "border-line bg-raise/50"}`}>
                <div className="flex items-center gap-2">
                  <Badge tone={r.success === false ? "danger" : "ok"}>{String(r.provider ?? "mock")}</Badge>
                  <span className="text-muted">{r.success === false ? "ناموفق" : "موفق"}</span>
                </div>
                <pre className="ltr mt-2 max-h-32 overflow-auto font-mono text-[9px] leading-4 text-muted" dir="ltr">
                  {JSON.stringify(r).slice(0, 400)}
                </pre>
                {r.url && (
                  <a href={String(r.url)} target="_blank" rel="noreferrer" className="mt-1 block truncate text-brand hover:underline dark:text-teal-300">
                    {String(r.url)}
                  </a>
                )}
                {r.payment_url && (
                  <a href={String(r.payment_url)} target="_blank" rel="noreferrer" className="mt-1 block truncate font-bold text-brand hover:underline dark:text-teal-300">
                    پرداخت: {String(r.payment_url)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-center text-[9px] leading-5 text-muted">
        معماری: Core (IntegrationService) جدا از Adapter — Factory بر اساس env — Mock قطعی برای تست بدون اینترنت — {" "}
        <Code>integration_logs</Code> با RLS
      </p>
    </div>
  );
}
