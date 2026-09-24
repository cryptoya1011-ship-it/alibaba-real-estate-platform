import { useEffect, useState } from "react";
import { Building2, ExternalLink, Globe, MapPin, RefreshCw } from "lucide-react";
import { api } from "../api";
import { faDate, faNum, toman, PROPERTY_TYPE_FA } from "../lib/format";
import type { PublicProperty } from "../lib/types";
import { Badge, Button, Card, Code, CopyBtn, EmptyState, ListSkeleton, PageHead } from "../components/ui";

export default function PublicListPage() {
  const [items, setItems] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems((await api.publicListProperties({ limit: 50 })) as PublicProperty[]);
    } catch (e) {
      console.error("public list failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHead
        title="پلتفرم عمومی"
        desc="فقط املاک منتشرشده — Public DTO + SEO + Deep Link، بدون احراز هویت"
        icon={<Globe className="h-5 w-5" />}
        action={
          <Button size="sm" variant="outline" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>
            بازخوانی
          </Button>
        }
      />

      {loading && items.length === 0 ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-6 w-6" />}
          title="ملک منتشرشده‌ای وجود ندارد"
          desc="پس از انتشار ملک (status = published)، اینجا نمایش داده می‌شود و لینک /p/{code} فعال می‌گردد."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${Math.min(i * 30, 250)}ms` }} className="animate-slide-up">
              <Card className="flex h-full gap-3 overflow-hidden p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-raise">
                  {p.primary_image ? (
                    <img src={p.primary_image} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-bold">{p.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                    <Code>{p.code}</Code>
                    {p.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {p.city} {p.district ? `• ${p.district}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="tnum mt-1.5 text-xs font-bold text-brand dark:text-teal-300">{toman(p.price)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">{PROPERTY_TYPE_FA[p.property_type] ?? p.property_type}</Badge>
                    <span className="text-[9px] text-muted">{faDate(p.created_at)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <a
                      href={`/p/${p.code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[10px] transition hover:bg-raise"
                    >
                      <ExternalLink className="h-3 w-3" />
                      /p/{p.code}
                    </a>
                    <CopyBtn text={`${window.location.origin}/p/${p.code}`} label="کپی لینک عمومی" />
                    <a
                      href={`/api/v1/public/og/${p.code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center rounded-lg border border-line px-2 text-[10px] text-muted transition hover:bg-raise"
                    >
                      OG
                    </a>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-raise/50 p-3 text-[10px] text-muted">
        <span>کل املاک منتشرشده: <b className="text-ink">{faNum(items.length)}</b></span>
        <span>•</span>
        <span>OG + JSON-LD برای اشتراک‌گذاری در شبکه‌های اجتماعی فعال است</span>
      </div>
    </div>
  );
}
