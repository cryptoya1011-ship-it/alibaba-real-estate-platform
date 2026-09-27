import { CheckCircle2, CircleDashed, Building2, UserSearch } from "lucide-react";
import type { AIMatch } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Code, ScoreBar, StaggerItem, StaggerList } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { cityName, propertyTypeLabel, transactionLabel, PROVIDER_NAME_FA } from "@/lib/constants";
import { compactToman, faNum } from "@/lib/format";

/** Match results (request↔property) with animated score bars + Persian reasons. */
export function MatchList({ matches, emptyHint }: { matches: AIMatch[]; emptyHint?: string }) {
  if (matches.length === 0) {
    return <EmptyState icon={CircleDashed} title="موردی با امتیاز کافی پیدا نشد" description={emptyHint ?? "فقط نتایج با امتیاز ۴۰٪ به بالا نمایش داده می‌شوند."} />;
  }
  return (
    <StaggerList className="flex flex-col gap-2.5">
      {matches.map((m, idx) => (
        <StaggerItem key={idx} className="rounded-[14px] bg-card-2 p-3.5 hairline">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-soft text-primary">
              {m.property ? <Building2 className="size-[18px]" aria-hidden /> : <UserSearch className="size-[18px]" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              {m.property && (
                <>
                  <p className="truncate font-semibold">{m.property.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                    <Code>{m.property.code}</Code>
                    <span className="tnum">{compactToman(m.property.price)}</span>
                    {m.property.built_area ? <span className="tnum">{faNum(m.property.built_area)} متر</span> : null}
                  </div>
                </>
              )}
              {m.request && (
                <>
                  <p className="font-semibold">
                    درخواست <span className="tnum">#{faNum(m.request.id)}</span> — {propertyTypeLabel(m.request.property_type)} {transactionLabel(m.request.transaction_type)}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {cityName(m.request.city_code)} · بودجه تا <span className="tnum">{compactToman(m.request.budget_max, "نامشخص")}</span>
                  </p>
                </>
              )}
            </div>
            {m.matched ? (
              <Badge tone="success">
                <CheckCircle2 aria-hidden /> مطابق
              </Badge>
            ) : (
              <Badge tone="warning">نسبی</Badge>
            )}
          </div>
          <ScoreBar score={m.score} className="mt-3" />
          {m.reasons.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {m.reasons.map((r, i) => (
                <li key={i} className="tnum rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] text-muted-foreground">
                  {r}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground/80">موتور: {PROVIDER_NAME_FA[m.provider] ?? m.provider}</p>
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
