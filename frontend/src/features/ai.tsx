import { useCallback, useEffect, useState } from "react";
import { Braces, FileText, Sparkles, Wand2, Zap } from "lucide-react";
import { ApiError, api } from "../api";
import { faNum, pct, toman } from "../lib/format";
import type { MatchItem, PropertyListItem } from "../lib/types";
import { useData } from "../state/data";
import { Badge, Button, Card, Code, EmptyState, ListSkeleton, MatchesList, PageHead, Textarea } from "../components/ui";
import { toast } from "sonner";

type Parsed = {
  parsed_by?: string;
  provider?: string;
  confidence?: number;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
};

export default function AiPage() {
  const { properties, persons } = useData();
  const [providers, setProviders] = useState<{ current: string; available: string[]; details: Record<string, { type: string; requires_api_key: boolean; has_key: boolean }> } | null>(null);
  const [query, setQuery] = useState("آپارتمان ۱۲۰ متری در مرداویج اصفهان با پارکینگ و آسانسور تا ۱۵ میلیارد");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [results, setResults] = useState<PropertyListItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [desc, setDesc] = useState<{ code: string; text: string; provider: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      setProviders(await api.aiListProviders());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در اجرای درخواست AI");
    } finally {
      setBusy(null);
    }
  };

  const doParse = () =>
    run("parse", async () => {
      if (!query.trim()) {
        toast.error("متن جستجو را وارد کنید");
        return;
      }
      setParsed((await api.aiParseSearch(query)) as Parsed);
      toast.success("متن با موفقیت تحلیل شد");
    });

  const doSearch = () =>
    run("search", async () => {
      if (!query.trim()) {
        toast.error("متن جستجو را وارد کنید");
        return;
      }
      const res = await api.aiSearchExecute(query);
      setParsed(res.parsed as Parsed);
      setResults((res.properties ?? []) as PropertyListItem[]);
      toast.success(`${faNum((res.properties ?? []).length)} ملک پیدا شد`);
    });

  const matchRequest = (requestId: number) =>
    run("match", async () => {
      setMatches((await api.aiMatchRequest(requestId)) as MatchItem[]);
    });

  const matchProperty = (propertyId: number) =>
    run("match", async () => {
      setMatches((await api.aiMatchProperty(propertyId)) as MatchItem[]);
    });

  const suggest = (propertyId: number, title: string) =>
    run("desc", async () => {
      const res = await api.aiSuggestDescription(propertyId);
      setDesc({ code: res.code ?? title, text: res.suggested_description, provider: res.provider });
    });

  return (
    <div className="animate-fade-in">
      <PageHead
        title="هوش مصنوعی"
        desc="Core جدا از Adapter — mock قانون‌محور فارسی، deterministic و بدون اینترنت"
        icon={<Sparkles className="h-5 w-5" />}
      />

      {/* Providers */}
      {providers && (
        <Card className="mb-4 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold">
            <Zap className="h-3.5 w-3.5 text-brand" />
            ارائه‌دهنده فعال: <Badge tone="brand">{providers.current}</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(providers.details ?? {}).map(([k, v]) => (
              <span
                key={k}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  providers.current === k ? "bg-brand text-white dark:text-slate-900" : "bg-raise text-muted"
                }`}
              >
                <span className="ltr font-mono" dir="ltr">
                  {k}
                </span>
                <span className="opacity-70">{v.type}</span>
                {v.requires_api_key && <span>{v.has_key ? "🔑✓" : "🔑✗"}</span>}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Natural language search */}
      <Card className="mb-4 p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Wand2 className="h-4 w-4 text-brand" />
          جستجوی زبان طبیعی
        </h2>
        <p className="mb-3 text-[10px] text-muted">فارسی بنویسید؛ سیستم آن را به فیلتر ساخت‌یافته تبدیل و اجرا می‌کند.</p>
        <Textarea value={query} onChange={(e) => setQuery(e.target.value)} className="mb-3 min-h-[80px] text-xs leading-6" />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["آپارتمان ۸۰ متری زیر ۵ میلیارد", "ویلا با استخر در اصفهان", "زمین تجاری در مرداویج"].map((s) => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="rounded-full border border-line bg-raise px-2.5 py-1 text-[10px] text-muted transition hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="soft" size="sm" loading={busy === "parse"} onClick={doParse} icon={<Braces className="h-3.5 w-3.5" />}>
            تحلیل متن
          </Button>
          <Button size="sm" loading={busy === "search"} onClick={doSearch} icon={<Sparkles className="h-3.5 w-3.5" />}>
            جستجو + اجرا
          </Button>
        </div>

        {parsed && (
          <div className="mt-4 rounded-xl border border-line bg-raise p-3 animate-fade-in">
            <div className="mb-2 flex items-center gap-2 text-[11px]">
              <Badge tone="brand">{parsed.parsed_by ?? parsed.provider ?? "mock"}</Badge>
              {typeof parsed.confidence === "number" && <span className="text-muted">اطمینان {pct(parsed.confidence)}</span>}
            </div>
            {parsed.filters && Object.keys(parsed.filters).length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {Object.entries(parsed.filters).map(([k, v]) => (
                  <span key={k} className="rounded-lg border border-line bg-surface px-2 py-1 text-[10px]">
                    <span className="ltr font-mono text-muted" dir="ltr">
                      {k}
                    </span>
                    <span className="mx-1">=</span>
                    <b>{String(v)}</b>
                  </span>
                ))}
              </div>
            )}
            <details className="group">
              <summary className="cursor-pointer text-[10px] text-muted">نمایش JSON کامل</summary>
              <pre className="ltr mt-2 max-h-56 overflow-auto rounded-lg bg-surface p-2 font-mono text-[9px] leading-4" dir="ltr">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-bold">{faNum(results.length)} نتیجه</div>
            <ul className="space-y-2">
              {results.map((p) => (
                <li key={p.id} className="rounded-xl border border-line bg-raise/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold">{p.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                        <Code>{p.code}</Code>
                        <span className="tnum">{toman(p.price)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button variant="soft" size="xs" loading={busy === "match"} onClick={() => matchProperty(p.id)}>
                        تطبیق
                      </Button>
                      <Button variant="ghost" size="xs" loading={busy === "desc"} onClick={() => suggest(p.id, p.title)}>
                        توضیح
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Auto matching */}
      <Card className="mb-4 p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-brand" />
          تطبیق خودکار درخواست ↔ ملک
        </h2>
        <p className="mb-3 text-[10px] text-muted">امتیاز تطبیق (۰ تا ۱) همراه با دلایل فارسی برای هر جفت.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {persons.slice(0, 4).map((per) => (
            <button
              key={per.id}
              onClick={async () => {
                const reqs = (await api.listRequests({ person_id: per.id })) as { id: number }[];
                if (reqs.length === 0) {
                  toast.info("برای این مشتری درخواستی ثبت نشده است");
                  return;
                }
                matchRequest(reqs[0].id);
              }}
              className="rounded-full border border-line bg-raise px-2.5 py-1 text-[10px] text-muted transition hover:text-ink"
            >
              درخواست‌های {per.display_name}
            </button>
          ))}
          {properties.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => matchProperty(p.id)}
              className="rounded-full border border-line bg-raise px-2.5 py-1 text-[10px] text-muted transition hover:text-ink"
            >
              ملک: {p.title.slice(0, 18)}
            </button>
          ))}
        </div>
        {busy === "match" ? <ListSkeleton /> : matches.length > 0 ? <MatchesList matches={matches} /> : null}
      </Card>

      {/* Suggested description */}
      {desc && (
        <Card className="mb-4 p-4 animate-fade-in">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <FileText className="h-4 w-4 text-brand" />
            توضیح پیشنهادی برای <Code>{desc.code}</Code>
          </h2>
          <p className="rounded-xl border border-line bg-raise p-3 text-xs leading-6">{desc.text}</p>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="brand">Provider: {desc.provider}</Badge>
            <Button
              size="sm"
              variant="soft"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(desc.text);
                  toast.success("کپی شد");
                } catch {
                  toast.error("کپی ناموفق بود");
                }
              }}
            >
              کپی متن
            </Button>
          </div>
        </Card>
      )}

      {!providers && !results.length && matches.length === 0 && <EmptyState icon={<Sparkles className="h-6 w-6" />} title="آماده برای شروع" desc="یک متن فارسی بنویسید و «تحلیل متن» را بزنید." />}
    </div>
  );
}
