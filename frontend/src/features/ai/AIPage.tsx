import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bot, Building2, Check, ClipboardList, KeyRound, ListFilter, Search, Sparkles, Wand2, X } from "lucide-react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";
import type { AIDescription, AIMatch, AIParsed, AISearchResult } from "@/lib/types";
import { AI_PROVIDER_TYPE_FA, AI_PROVIDER_NAME_FA, cityName, districtName, propertyTypeLabel, transactionLabel } from "@/lib/constants";
import { compactToman, faNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { CopyButton, KeyValue, PageHeader, ScoreBar, SectionTitle, StaggerItem, StaggerList } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorMessage } from "@/components/ui/states";
import { useFavorites } from "@/features/favorites/useFavorites";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { PropertyDetailDialog } from "@/features/properties/PropertyDetailDialog";
import { MatchList } from "./MatchList";

type Tab = "search" | "match" | "describe";
const DEFAULT_PROVIDER = "__default";

const EXAMPLES = ["آپارتمان ۱۰۰ متری در مرداویج تا ۱۵ میلیارد با پارکینگ", "اجاره مغازه در ونک", "ویلا با استخر زیر ۲۰ میلیارد در تهران"];

export default function AIPage() {
  const [tab, setTab] = useState<Tab>("search");
  const providers = useApi(() => api.aiListProviders(), [], { keys: ["ai-providers"] });
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  // Only engines that really exist can be chosen — nothing is relabelled or faked.
  const implementedProviders = (providers.data?.available ?? []).filter((p) => providers.data?.details[p]?.implemented !== false);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader icon={Sparkles} title="دستیار هوشمند" description="جستجوی زبان طبیعی، تطبیق خودکار و نوشتن توضیحات آگهی" />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-body font-semibold">
              <Bot className="size-[18px] text-primary" aria-hidden /> ارائه‌دهنده‌ها
            </p>
            {providers.data && (
              <span className="text-caption text-muted-foreground">
                فعلی: <b className="text-foreground">{AI_PROVIDER_NAME_FA[providers.data.current] ?? providers.data.current}</b>
              </span>
            )}
          </div>
          {providers.loading ? (
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          ) : providers.error ? (
            <ErrorState error={providers.error} onRetry={providers.reload} />
          ) : providers.data ? (
            <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {Object.entries(providers.data.details).map(([name, det]) => {
                const implemented = det.implemented !== false;
                const ready = implemented && (!det.requires_api_key || det.has_key);
                const current = name === providers.data?.current;
                return (
                  <li
                    key={name}
                    className={cn(
                      "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-caption hairline",
                      current ? "border-primary/50 bg-primary-soft text-primary" : "bg-card-2",
                    )}
                    title={det.description}
                  >
                    {ready ? <Check className="size-3.5 text-success" aria-hidden /> : <X className="size-3.5 text-danger" aria-hidden />}
                    <span className="font-semibold">{AI_PROVIDER_NAME_FA[name] ?? name}</span>
                    <span className="text-muted-foreground">{implemented ? (AI_PROVIDER_TYPE_FA[det.type] ?? det.type) : "پیاده‌سازی نشده"}</span>
                    {det.requires_api_key && (
                      <KeyRound className={cn("size-3.5", det.has_key ? "text-accent" : "text-muted-foreground/60")} aria-label={det.has_key ? "کلید تنظیم شده" : "بدون کلید"} />
                    )}
                    <span className="sr-only">{ready ? "آماده" : "غیرفعال"}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {providers.data?.note && (
            <p className="rounded-[12px] bg-warning-soft px-3 py-2 text-caption leading-6">
              ارائه‌دهندهٔ انتخاب‌شده ({AI_PROVIDER_NAME_FA[providers.data.requested ?? ""] ?? providers.data.requested}) هنوز پیاده‌سازی نشده؛ از موتور داخلی استفاده می‌شود.
            </p>
          )}
        </CardContent>
      </Card>

      <Segmented<Tab>
        aria-label="ابزارها"
        value={tab}
        onChange={setTab}
        items={[
          { value: "search", label: "جستجوی هوشمند", icon: <Search className="size-4" aria-hidden /> },
          { value: "match", label: "تطبیق", icon: <Sparkles className="size-4" aria-hidden /> },
          { value: "describe", label: "توضیحات", icon: <Wand2 className="size-4" aria-hidden /> },
        ]}
      />

      {tab === "search" && (
        <SearchTool
          provider={provider === DEFAULT_PROVIDER ? undefined : provider}
          providerSelect={
            implementedProviders.length < 2 ? null : (
            <Select
              aria-label="ارائه‌دهنده"
              value={provider}
              onValueChange={setProvider}
              className="sm:w-48"
              options={[
                { value: DEFAULT_PROVIDER, label: "پیش‌فرض" },
                ...implementedProviders.map((p) => ({ value: p, label: AI_PROVIDER_NAME_FA[p] ?? p })),
              ]}
            />
            )
          }
        />
      )}
      {tab === "match" && <MatchTool />}
      {tab === "describe" && <DescribeTool />}
    </div>
  );
}

const searchSchema = z.object({ text: z.string().trim().min(3, "عبارت جستجو را بنویسید").max(500) });

function SearchTool({ provider, providerSelect }: { provider?: string; providerSelect: ReactNode }) {
  const { register, handleSubmit, setValue, formState } = useForm<{ text: string }>({ resolver: zodResolver(searchSchema), defaultValues: { text: "" } });
  const [parsed, setParsed] = useState<AIParsed | null>(null);
  const [result, setResult] = useState<AISearchResult | null>(null);
  const [busy, setBusy] = useState<"parse" | "execute" | null>(null);
  const favorites = useFavorites();
  const [detailId, setDetailId] = useState<number | null>(null);

  const run = (mode: "parse" | "execute") =>
    handleSubmit(async ({ text }) => {
      setBusy(mode);
      try {
        if (mode === "parse") {
          setParsed(await api.aiParseSearch(text, provider));
          setResult(null);
        } else {
          const r = await api.aiSearchExecute(text, provider);
          setResult(r);
          setParsed(r.parsed);
          toast.success(r.properties.length ? `${faNum(r.properties.length)} ملک پیدا شد` : "ملکی مطابق پیدا نشد");
        }
      } catch (err) {
        toast.error(errorMessage(err, "درخواست هوش مصنوعی ناموفق بود"));
      } finally {
        setBusy(null);
      }
    })();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("execute");
            }}
            noValidate
            className="flex flex-col gap-3"
          >
            <Field label="چه ملکی می‌خواهید؟" error={formState.errors.text?.message}>
              {(id, d) => <Textarea id={id} rows={3} aria-describedby={d} placeholder="به زبان ساده بنویسید…" {...register("text")} />}
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setValue("text", ex, { shouldValidate: true })}
                  className="min-h-9 rounded-full bg-muted px-3 text-caption text-muted-foreground transition hover:bg-primary-soft hover:text-primary"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {providerSelect}
              <div className="flex flex-1 gap-2 sm:justify-end">
                <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => run("parse")} loading={busy === "parse"} disabled={busy !== null}>
                  <ListFilter aria-hidden /> فقط تحلیل
                </Button>
                <Button type="submit" className="flex-1 sm:flex-none" loading={busy === "execute"} disabled={busy !== null}>
                  <Search aria-hidden /> جستجو
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {busy && !parsed && <Skeleton className="h-40" />}
      {parsed && <ParsedView parsed={parsed} />}
      {result && (
        <section className="flex flex-col gap-3">
          <SectionTitle>نتایج ({faNum(result.properties.length)})</SectionTitle>
          {result.properties.length === 0 ? (
            <EmptyState icon={Building2} title="ملکی مطابق این جستجو نیست" description="شرایط را کمی بازتر بنویسید (مثلاً بودجه یا محله)." />
          ) : (
            <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.properties.map((p) => (
                <StaggerItem key={p.id}>
                  <PropertyCard property={p} favorite={favorites.ids.has(p.id)} onToggleFavorite={() => favorites.toggle(p.id)} onOpen={() => setDetailId(p.id)} />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </section>
      )}
      <PropertyDetailDialog
        propertyId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        favorite={detailId !== null && favorites.ids.has(detailId)}
        onToggleFavorite={() => detailId !== null && favorites.toggle(detailId)}
      />
    </div>
  );
}

function yesNo(v: boolean | null) {
  return v === null ? null : v ? "دارد" : "ندارد";
}

function ParsedView({ parsed }: { parsed: AIParsed }) {
  const range = (min: number | null, max: number | null, fmt: (n: number) => string) =>
    min === null && max === null ? null : min !== null && max !== null ? `${fmt(min)} تا ${fmt(max)}` : min !== null ? `از ${fmt(min)}` : `تا ${fmt(max as number)}`;
  const fields: [string, string | null][] = [
    ["نوع ملک", parsed.property_type ? propertyTypeLabel(parsed.property_type) : null],
    ["معامله", parsed.transaction_type ? transactionLabel(parsed.transaction_type) : null],
    ["شهر", parsed.city ?? (parsed.city_code ? cityName(parsed.city_code) : null)],
    ["محله", parsed.district ?? (parsed.district_code ? districtName(parsed.district_code) : null)],
    ["متراژ", range(parsed.min_area, parsed.max_area, (n) => `${faNum(n)} متر`)],
    ["قیمت", range(parsed.min_price, parsed.max_price, (n) => compactToman(n))],
    ["اتاق", parsed.rooms !== null ? faNum(parsed.rooms) : parsed.bedrooms !== null ? faNum(parsed.bedrooms) : null],
    ["پارکینگ", yesNo(parsed.has_parking)],
    ["آسانسور", yesNo(parsed.has_elevator)],
    ["انباری", yesNo(parsed.has_warehouse)],
    ["بالکن", yesNo(parsed.has_balcony)],
  ];
  const found = fields.filter(([, v]) => v !== null) as [string, string][];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListFilter className="size-[18px] text-primary" aria-hidden /> برداشت هوش مصنوعی
        </CardTitle>
        <CardDescription>
          تحلیل با <b>{AI_PROVIDER_NAME_FA[parsed.parsed_by] ?? parsed.parsed_by}</b>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-caption text-muted-foreground">اطمینان</p>
          <ScoreBar score={parsed.confidence} />
        </div>
        {found.length === 0 ? (
          <p className="text-body text-muted-foreground">فیلتر مشخصی استخراج نشد.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {found.map(([k, v]) => (
              <KeyValue key={k} label={k} value={<span className="tnum">{v}</span>} className="rounded-[12px] bg-card-2 p-2.5 hairline" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchTool() {
  const [mode, setMode] = useState<"request" | "property">("request");
  const requests = useApi(() => api.listRequests({ limit: 100 }), [], { keys: ["requests"] });
  const properties = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties"] });
  const persons = useApi(() => api.listPersons({ limit: 100 }), [], { keys: ["persons"] });
  const [target, setTarget] = useState("");
  const [matches, setMatches] = useState<AIMatch[] | null>(null);
  const [busy, setBusy] = useState(false);

  const personName = (id: number) => persons.data?.find((p) => p.id === id)?.display_name ?? `#${faNum(id)}`;
  const options =
    mode === "request"
      ? (requests.data ?? []).map((r) => ({
          value: String(r.id),
          label: `${personName(r.person_id)} · ${propertyTypeLabel(r.property_type)} ${transactionLabel(r.transaction_type)}`,
          hint: r.budget_max ? `تا ${compactToman(r.budget_max)}` : undefined,
        }))
      : (properties.data ?? []).map((p) => ({ value: String(p.id), label: p.title, hint: p.code }));

  const run = async () => {
    if (!target) {
      toast.error(mode === "request" ? "یک درخواست انتخاب کنید" : "یک ملک انتخاب کنید");
      return;
    }
    setBusy(true);
    setMatches(null);
    try {
      const res = mode === "request" ? await api.aiMatchRequest(Number(target)) : await api.aiMatchProperty(Number(target));
      setMatches(res);
    } catch (err) {
      toast.error(errorMessage(err, "تطبیق ناموفق بود"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Segmented
            size="sm"
            aria-label="نوع تطبیق"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setTarget("");
              setMatches(null);
            }}
            items={[
              { value: "request", label: "درخواست ← املاک", icon: <ClipboardList className="size-4" aria-hidden /> },
              { value: "property", label: "ملک ← درخواست‌ها", icon: <Building2 className="size-4" aria-hidden /> },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              aria-label={mode === "request" ? "درخواست" : "ملک"}
              className="sm:flex-1"
              value={target}
              onValueChange={setTarget}
              placeholder={mode === "request" ? (requests.data?.length === 0 ? "درخواستی ثبت نشده" : "انتخاب درخواست مشتری") : "انتخاب ملک"}
              options={options}
            />
            <Button onClick={run} loading={busy}>
              <Sparkles aria-hidden /> تطبیق
            </Button>
          </div>
        </CardContent>
      </Card>
      {busy && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {matches && <MatchList matches={matches} />}
    </div>
  );
}

function DescribeTool() {
  const properties = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties"] });
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<AIDescription | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!target) {
      toast.error("یک ملک انتخاب کنید");
      return;
    }
    setBusy(true);
    try {
      setResult(await api.aiSuggestDescription(Number(target)));
      toast.success("توضیحات پیشنهادی آماده شد");
    } catch (err) {
      toast.error(errorMessage(err, "تولید توضیحات ناموفق بود"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row">
          <Select
            aria-label="ملک"
            className="sm:flex-1"
            value={target}
            onValueChange={setTarget}
            placeholder="انتخاب ملک"
            options={(properties.data ?? []).map((p) => ({ value: String(p.id), label: p.title, hint: p.code }))}
          />
          <Button onClick={run} loading={busy}>
            <Wand2 aria-hidden /> پیشنهاد توضیحات
          </Button>
        </CardContent>
      </Card>
      {busy && !result && <Skeleton className="h-32" />}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{result.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Badge tone="accent">{AI_PROVIDER_NAME_FA[result.provider] ?? result.provider}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="whitespace-pre-line rounded-[12px] bg-card-2 p-3.5 text-body leading-7 hairline">{result.suggested_description}</p>
            <CopyButton text={result.suggested_description} label="کپی متن" variant="secondary" success="متن کپی شد" className="self-start" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
