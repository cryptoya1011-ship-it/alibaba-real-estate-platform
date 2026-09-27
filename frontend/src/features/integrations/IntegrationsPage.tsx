import { useState, type ReactNode } from "react";
import { Controller, useForm, type Control, type FieldValues, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  ExternalLink,
  KeyRound,
  Link2,
  MapPin,
  Megaphone,
  MessageSquareText,
  Navigation,
  Plug,
  RotateCw,
  ScrollText,
  Send,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import type { IntegrationResult } from "@/lib/types";
import { INTEGRATION_PROVIDER_META, PROVIDER_NAME_FA } from "@/lib/constants";
import { faNum, formatToman, parseNumber, relativeTime, toEnDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { Code, CopyButton, PageHeader, SectionTitle } from "@/components/ui/misc";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  telegram: Send,
  sms: MessageSquareText,
  divar: Megaphone,
  sheypoor: Megaphone,
  payment: CreditCard,
  maps: MapPin,
};

function afterCall() {
  invalidate("integration-logs");
}

export default function IntegrationsPage() {
  const providers = useApi(() => api.intListProviders(), [], { keys: ["integration-providers"] });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Plug}
        title="یکپارچه‌سازی"
        description="تلگرام، پیامک، دیوار/شیپور، پرداخت و نقشه"
        actions={
          <Button variant="ghost" size="icon" onClick={providers.reload} aria-label="بارگذاری مجدد" disabled={providers.refreshing}>
            <RotateCw className={providers.refreshing ? "animate-spin" : ""} aria-hidden />
          </Button>
        }
      />

      {providers.loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : providers.error ? (
        <ErrorState error={providers.error} onRetry={providers.reload} />
      ) : providers.data ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(providers.data.details).map(([key, det]) => {
            const Icon = PROVIDER_ICONS[key] ?? Plug;
            const meta = INTEGRATION_PROVIDER_META[key] ?? { label: key, hint: "" };
            const isMock = det.provider === "mock";
            return (
              <li key={key} className="flex flex-col gap-2 rounded-[16px] bg-card p-3 shadow-sm hairline">
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-[10px] bg-primary-soft text-primary">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span
                    className={cn("flex items-center gap-1 text-caption", det.has_key ? "text-accent" : "text-muted-foreground")}
                    aria-label={det.has_key ? "کلید تنظیم شده" : "بدون کلید"}
                    title={det.has_key ? "کلید تنظیم شده" : "بدون کلید"}
                  >
                    {det.has_key ? (
                      <span aria-hidden className="text-body leading-none">
                        🔑
                      </span>
                    ) : (
                      <KeyRound className="size-3.5 opacity-50" aria-hidden />
                    )}
                    <span className="text-[11px]">{det.has_key ? "کلید دارد" : "بدون کلید"}</span>
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-caption text-muted-foreground">{meta.hint}</p>
                </div>
                <Badge tone={isMock ? "warning" : "success"} className="self-start">
                  {PROVIDER_NAME_FA[det.provider] ?? det.provider}
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TelegramTool />
        <SmsTool />
        <ListingTool />
        <PaymentTool />
        <MapsTool />
      </div>

      <LogsSection />
    </div>
  );
}

// ---------- shared building blocks ----------

function ToolCard({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-[18px] text-primary" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function ResultBox({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "info" }) {
  return (
    <div
      role="status"
      className={cn("flex flex-col gap-1.5 rounded-[12px] p-3 text-body", tone === "success" ? "bg-success-soft" : "bg-info-soft")}
    >
      {children}
    </div>
  );
}

function MockBadge({ result }: { result: IntegrationResult | null }) {
  if (!result?.mock) return null;
  return <Badge tone="warning">حالت آزمایشی</Badge>;
}

/** Tiny wrapper: zod schema → typed form + async submit with toast + log refresh. */
function useTool<T extends FieldValues>(schema: z.ZodType<T, T>, defaults: T) {
  return useForm<T>({ resolver: zodResolver(schema) as unknown as Resolver<T>, defaultValues: defaults as never });
}

const phoneField = z.string().trim().regex(/^[+0-9۰-۹]{8,15}$/, "شماره معتبر نیست");

// ---------- Telegram ----------

type TgMode = "send" | "property" | "deeplink";

function TelegramTool() {
  const [mode, setMode] = useState<TgMode>("send");
  return (
    <ToolCard icon={Send} title="تلگرام">
      <Segmented<TgMode>
        size="sm"
        aria-label="عملیات تلگرام"
        value={mode}
        onChange={setMode}
        items={[
          { value: "send", label: "ارسال پیام" },
          { value: "property", label: "ارسال ملک" },
          { value: "deeplink", label: "لینک عمیق" },
        ]}
      />
      {mode === "send" && <TgSend />}
      {mode === "property" && <TgProperty />}
      {mode === "deeplink" && <TgDeepLink />}
    </ToolCard>
  );
}

const tgSendSchema = z.object({ chat_id: z.string().trim().min(1, "شناسه چت الزامی است"), text: z.string().trim().min(1, "متن پیام الزامی است").max(4000) });
function TgSend() {
  const f = useTool(tgSendSchema, { chat_id: "", text: "" });
  const [res, setRes] = useState<IntegrationResult | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      const r = await api.intTelegramSend(toEnDigits(v.chat_id), v.text);
      setRes(r);
      toast.success("پیام تلگرام ارسال شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "ارسال پیام ناموفق بود"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="شناسه چت" error={f.formState.errors.chat_id?.message}>
        {(id, d) => <Input id={id} ltr placeholder="1000001" aria-describedby={d} {...f.register("chat_id")} />}
      </Field>
      <Field label="متن پیام" error={f.formState.errors.text?.message}>
        {(id, d) => <Textarea id={id} rows={2} aria-describedby={d} {...f.register("text")} />}
      </Field>
      <Button type="submit" loading={f.formState.isSubmitting}>
        <Send aria-hidden /> ارسال
      </Button>
      {res && (
        <ResultBox>
          <span className="flex items-center gap-2">
            ارسال شد · شناسه پیام <Code>{String(res.message_id ?? "—")}</Code> <MockBadge result={res} />
          </span>
        </ResultBox>
      )}
    </form>
  );
}

const tgPropSchema = z.object({ property_id: z.string().min(1, "ملک را انتخاب کنید"), chat_id: z.string().trim().min(1, "شناسه چت الزامی است") });
function TgProperty() {
  const props = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties"] });
  const f = useTool(tgPropSchema, { property_id: "", chat_id: "" });
  const [res, setRes] = useState<IntegrationResult | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      const r = await api.intTelegramSendProperty(Number(v.property_id), toEnDigits(v.chat_id));
      setRes(r);
      toast.success("ملک در تلگرام ارسال شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "ارسال ملک ناموفق بود"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <PropertySelectField control={f.control} name="property_id" error={f.formState.errors.property_id?.message} options={(props.data ?? []).map((p) => ({ value: String(p.id), label: p.title, hint: p.code }))} />
      <Field label="شناسه چت" error={f.formState.errors.chat_id?.message}>
        {(id, d) => <Input id={id} ltr placeholder="1000001" aria-describedby={d} {...f.register("chat_id")} />}
      </Field>
      <Button type="submit" loading={f.formState.isSubmitting}>
        <Send aria-hidden /> ارسال ملک
      </Button>
      {res && (
        <ResultBox>
          <span className="flex items-center gap-2">
            ارسال شد · شناسه پیام <Code>{String(res.message_id ?? "—")}</Code> <MockBadge result={res} />
          </span>
        </ResultBox>
      )}
    </form>
  );
}

const tgLinkSchema = z.object({ payload: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/, "فقط حروف انگلیسی، عدد، - و _") });
function TgDeepLink() {
  const f = useTool(tgLinkSchema, { payload: "" });
  const [link, setLink] = useState<string | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      const r = await api.intTelegramDeepLink(v.payload);
      setLink(r.deep_link ?? null);
      toast.success("لینک عمیق ساخته شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "ساخت لینک ناموفق بود"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="پارامتر start" error={f.formState.errors.payload?.message} hint="مثلاً کد ملک یا invite_…">
        {(id, d) => <Input id={id} ltr placeholder="AB-00001" aria-describedby={d} {...f.register("payload")} />}
      </Field>
      <Button type="submit" loading={f.formState.isSubmitting}>
        <Link2 aria-hidden /> ساخت لینک
      </Button>
      {link && (
        <ResultBox>
          <div className="flex items-center gap-2">
            <a href={link} target="_blank" rel="noreferrer" dir="ltr" className="min-w-0 flex-1 truncate font-mono text-caption text-primary underline">
              {link}
            </a>
            <CopyButton text={link} size="sm" variant="ghost" label="کپی" />
          </div>
        </ResultBox>
      )}
    </form>
  );
}

function PropertySelectField<T extends FieldValues>({
  control,
  name,
  error,
  options,
}: {
  control: Control<T>;
  name: Path<T>;
  error?: string;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <Field label="ملک" error={error}>
      {(id) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => <Select id={id} invalid={!!error} value={String(field.value ?? "")} onValueChange={field.onChange} placeholder="انتخاب ملک" options={options} />}
        />
      )}
    </Field>
  );
}

// ---------- SMS ----------

type SmsMode = "send" | "otp";
const smsSchema = z.object({ phone: phoneField, message: z.string().trim().min(1, "متن پیامک الزامی است").max(612) });
const otpSchema = z.object({ phone: phoneField });

function SmsTool() {
  const [mode, setMode] = useState<SmsMode>("send");
  return (
    <ToolCard icon={MessageSquareText} title="پیامک">
      <Segmented<SmsMode>
        size="sm"
        aria-label="عملیات پیامک"
        value={mode}
        onChange={setMode}
        items={[
          { value: "send", label: "ارسال پیامک" },
          { value: "otp", label: "کد یک‌بارمصرف" },
        ]}
      />
      {mode === "send" ? <SmsSend /> : <SmsOtp />}
    </ToolCard>
  );
}

function SmsSend() {
  const f = useTool(smsSchema, { phone: "", message: "" });
  const [res, setRes] = useState<IntegrationResult | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      setRes(await api.intSmsSend(toEnDigits(v.phone), v.message));
      toast.success("پیامک ارسال شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "ارسال پیامک ناموفق بود"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="موبایل" error={f.formState.errors.phone?.message}>
        {(id, d) => <Input id={id} ltr inputMode="tel" placeholder="09131234567" aria-describedby={d} {...f.register("phone")} />}
      </Field>
      <Field label="متن" error={f.formState.errors.message?.message}>
        {(id, d) => <Textarea id={id} rows={2} aria-describedby={d} {...f.register("message")} />}
      </Field>
      <Button type="submit" loading={f.formState.isSubmitting}>
        <MessageSquareText aria-hidden /> ارسال پیامک
      </Button>
      {res && (
        <ResultBox>
          <span className="flex items-center gap-2">
            ارسال شد به <Code>{String(res.to ?? "")}</Code> <MockBadge result={res} />
          </span>
        </ResultBox>
      )}
    </form>
  );
}

function SmsOtp() {
  const f = useTool(otpSchema, { phone: "" });
  const [res, setRes] = useState<IntegrationResult | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      setRes(await api.intSmsOtp(toEnDigits(v.phone)));
      toast.success("کد یک‌بارمصرف ارسال شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "ارسال کد ناموفق بود"));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="موبایل" error={f.formState.errors.phone?.message}>
        {(id, d) => <Input id={id} ltr inputMode="tel" placeholder="09131234567" aria-describedby={d} {...f.register("phone")} />}
      </Field>
      <Button type="submit" loading={f.formState.isSubmitting}>
        <ShieldCheck aria-hidden /> ارسال کد
      </Button>
      {res && (
        <ResultBox>
          <span className="flex items-center gap-2">
            کد ارسال شد{res.code ? <> · کد آزمایشی <Code>{String(res.code)}</Code></> : null} <MockBadge result={res} />
          </span>
        </ResultBox>
      )}
    </form>
  );
}

// ---------- Listings ----------

const listingSchema = z.object({ platform: z.enum(["divar", "sheypoor"]), property_id: z.string().min(1, "ملک را انتخاب کنید") });
function ListingTool() {
  const props = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties"] });
  const f = useTool(listingSchema, { platform: "divar", property_id: "" });
  const [res, setRes] = useState<IntegrationResult | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      const r = await api.intPublishListing(v.platform, Number(v.property_id));
      setRes(r);
      toast.success(`آگهی در ${v.platform === "divar" ? "دیوار" : "شیپور"} منتشر شد`);
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "انتشار آگهی ناموفق بود"));
    }
  });
  return (
    <ToolCard icon={Megaphone} title="انتشار در دیوار / شیپور">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Controller
          control={f.control}
          name="platform"
          render={({ field }) => (
            <Segmented
              size="sm"
              aria-label="پلتفرم"
              value={field.value}
              onChange={field.onChange}
              items={[
                { value: "divar", label: "دیوار" },
                { value: "sheypoor", label: "شیپور" },
              ]}
            />
          )}
        />
        <PropertySelectField control={f.control} name="property_id" error={f.formState.errors.property_id?.message} options={(props.data ?? []).map((p) => ({ value: String(p.id), label: p.title, hint: p.code }))} />
        <Button type="submit" loading={f.formState.isSubmitting}>
          <Megaphone aria-hidden /> انتشار آگهی
        </Button>
        {res && (
          <ResultBox>
            <span className="flex flex-wrap items-center gap-2">
              شناسه آگهی <Code>{String(res.external_id ?? "—")}</Code> <MockBadge result={res} />
            </span>
            {res.url && (
              <a href={res.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline">
                مشاهده آگهی <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </ResultBox>
        )}
      </form>
    </ToolCard>
  );
}

// ---------- Payment ----------

const paymentSchema = z.object({
  amount: z.string().refine((v) => (parseNumber(v) ?? 0) >= 1000, "حداقل ۱٬۰۰۰ تومان"),
  description: z.string().trim().min(2, "توضیح الزامی است").max(255),
});
function PaymentTool() {
  const f = useTool(paymentSchema, { amount: "", description: "" });
  const [res, setRes] = useState<IntegrationResult | null>(null);
  const submit = f.handleSubmit(async (v) => {
    try {
      setRes(await api.intCreatePayment(parseNumber(v.amount) ?? 0, v.description));
      toast.success("لینک پرداخت ساخته شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "ساخت پرداخت ناموفق بود"));
    }
  });
  return (
    <ToolCard icon={CreditCard} title="پرداخت">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="مبلغ (تومان)" error={f.formState.errors.amount?.message}>
            {(id, d) => <Input id={id} inputMode="numeric" className="tnum" placeholder="۵۰۰۰۰۰" aria-describedby={d} {...f.register("amount")} />}
          </Field>
          <Field label="توضیح" error={f.formState.errors.description?.message}>
            {(id, d) => <Input id={id} placeholder="بیعانه" aria-describedby={d} {...f.register("description")} />}
          </Field>
        </div>
        <Button type="submit" loading={f.formState.isSubmitting}>
          <CreditCard aria-hidden /> ساخت لینک پرداخت
        </Button>
        {res && (
          <ResultBox>
            <span className="tnum flex items-center gap-2">
              {formatToman(res.amount ?? null, "—")} <MockBadge result={res} />
            </span>
            {res.payment_url && (
              <div className="flex items-center gap-2">
                <a href={res.payment_url} target="_blank" rel="noreferrer" dir="ltr" className="min-w-0 flex-1 truncate font-mono text-caption text-primary underline">
                  {res.payment_url}
                </a>
                <CopyButton text={res.payment_url} size="sm" variant="ghost" label="کپی" />
              </div>
            )}
          </ResultBox>
        )}
      </form>
    </ToolCard>
  );
}

// ---------- Maps ----------

const geoSchema = z.object({ address: z.string().trim().min(3, "آدرس را بنویسید").max(300) });
const coord = (min: number, max: number) => z.string().refine((v) => {
  const n = parseNumber(v);
  return n !== null && n >= min && n <= max;
}, "مختصات نامعتبر");
const distSchema = z.object({ lat1: coord(-90, 90), lng1: coord(-180, 180), lat2: coord(-90, 90), lng2: coord(-180, 180) });

function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

function MapsTool() {
  const geo = useTool(geoSchema, { address: "" });
  const dist = useTool(distSchema, { lat1: "32.6546", lng1: "51.6680", lat2: "35.6892", lng2: "51.3890" });
  const [point, setPoint] = useState<IntegrationResult | null>(null);
  const [km, setKm] = useState<number | null>(null);

  const geocode = geo.handleSubmit(async (v) => {
    try {
      const r = await api.intGeocode(v.address);
      setPoint(r);
      if (typeof r.lat === "number" && typeof r.lng === "number") {
        dist.setValue("lat1", String(r.lat));
        dist.setValue("lng1", String(r.lng));
      }
      toast.success("مختصات پیدا شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "مکان‌یابی ناموفق بود"));
    }
  });
  const distance = dist.handleSubmit(async (v) => {
    try {
      const r = await api.intDistance(parseNumber(v.lat1) ?? 0, parseNumber(v.lng1) ?? 0, parseNumber(v.lat2) ?? 0, parseNumber(v.lng2) ?? 0);
      setKm(r.distance_km ?? null);
      toast.success("فاصله محاسبه شد");
      afterCall();
    } catch (err) {
      toast.error(errorMessage(err, "محاسبه فاصله ناموفق بود"));
    }
  });

  return (
    <ToolCard icon={MapPin} title="نقشه" className="lg:col-span-2">
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={geocode} noValidate className="flex flex-col gap-3">
          <Field label="آدرس" error={geo.formState.errors.address?.message}>
            {(id, d) => <Input id={id} placeholder="اصفهان، خیابان مرداویج" aria-describedby={d} {...geo.register("address")} />}
          </Field>
          <Button type="submit" loading={geo.formState.isSubmitting}>
            <MapPin aria-hidden /> مکان‌یابی
          </Button>
          {point && typeof point.lat === "number" && typeof point.lng === "number" && (
            <ResultBox>
              <span className="flex flex-wrap items-center gap-2">
                <Code>
                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                </Code>
                {point.city && <span>{point.city}</span>}
                <MockBadge result={point} />
              </span>
              <a href={osmLink(point.lat, point.lng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline">
                نمایش در OpenStreetMap <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </ResultBox>
          )}
        </form>
        <form onSubmit={distance} noValidate className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["lat1", "lng1", "lat2", "lng2"] as const).map((k) => (
              <Field key={k} label={{ lat1: "عرض مبدأ", lng1: "طول مبدأ", lat2: "عرض مقصد", lng2: "طول مقصد" }[k]} error={dist.formState.errors[k]?.message}>
                {(id, d) => <Input id={id} ltr inputMode="decimal" className="font-mono" aria-describedby={d} {...dist.register(k)} />}
              </Field>
            ))}
          </div>
          <Button type="submit" variant="secondary" loading={dist.formState.isSubmitting}>
            <Navigation aria-hidden /> محاسبه فاصله
          </Button>
          {km !== null && (
            <ResultBox tone="info">
              <span className="tnum text-title font-bold">{faNum(Math.round(km * 10) / 10)} کیلومتر</span>
            </ResultBox>
          )}
        </form>
      </div>
    </ToolCard>
  );
}

// ---------- Logs ----------

function LogsSection() {
  const { data, error, loading, reload, refreshing } = useApi(() => api.intListLogs({ limit: 50 }), [], { keys: ["integration-logs"] });
  return (
    <section className="flex flex-col gap-3" aria-labelledby="logs-title">
      <SectionTitle
        action={
          <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
            <RotateCw className={refreshing ? "animate-spin" : ""} aria-hidden /> بارگذاری مجدد
          </Button>
        }
      >
        <span id="logs-title" className="flex items-center gap-2">
          <ScrollText className="size-[18px] text-muted-foreground" aria-hidden /> گزارش فراخوانی‌ها
        </span>
      </SectionTitle>
      {loading ? (
        <RowSkeleton count={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={ScrollText} title="هنوز فراخوانی ثبت نشده" description="با استفاده از ابزارهای بالا، گزارش‌ها اینجا نمایش داده می‌شوند." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>سرویس</TH>
                  <TH>عملیات</TH>
                  <TH>وضعیت</TH>
                  <TH>لینک / خطا</TH>
                  <TH>زمان</TH>
                </TR>
              </THead>
              <TBody>
                {data.map((l) => (
                  <TR key={l.id}>
                    <TD className="font-semibold">{INTEGRATION_PROVIDER_META[l.provider]?.label ?? l.provider}</TD>
                    <TD>
                      <Code>{l.action}</Code>
                    </TD>
                    <TD>
                      <Badge tone={l.status === "success" ? "success" : "danger"}>{l.status === "success" ? "موفق" : "ناموفق"}</Badge>
                    </TD>
                    <TD className="max-w-[260px]">
                      {l.external_url ? (
                        <a href={l.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                          مشاهده <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : l.error_message ? (
                        <span className="line-clamp-1 text-danger">{l.error_message}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{relativeTime(l.created_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {data.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-[14px] bg-card p-3 hairline">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {INTEGRATION_PROVIDER_META[l.provider]?.label ?? l.provider} <Code>{l.action}</Code>
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {relativeTime(l.created_at)}
                    {l.error_message ? ` · ${l.error_message}` : ""}
                  </p>
                </div>
                {l.external_url && (
                  <a href={l.external_url} target="_blank" rel="noreferrer" aria-label="مشاهده لینک" className="grid size-11 place-items-center rounded-full text-primary hover:bg-muted">
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
                <Badge tone={l.status === "success" ? "success" : "danger"}>{l.status === "success" ? "موفق" : "ناموفق"}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
