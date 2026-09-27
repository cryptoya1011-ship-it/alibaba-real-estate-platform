import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage({ inShell = false }: { inShell?: boolean }) {
  const body = (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="grid size-16 place-items-center rounded-[20px] bg-primary-soft text-primary">
        <Compass className="size-8" aria-hidden />
      </div>
      <p className="tnum text-display-lg font-extrabold">۴۰۴</p>
      <div>
        <h1 className="text-title-lg font-bold">صفحه پیدا نشد</h1>
        <p className="text-body text-muted-foreground">آدرسی که وارد کردید وجود ندارد یا جابه‌جا شده است.</p>
      </div>
      <Link to={inShell ? "/app" : "/"} className={buttonVariants()}>
        بازگشت به خانه
      </Link>
    </div>
  );
  if (inShell) return <div className="py-16">{body}</div>;
  return <div className="grid min-h-dvh place-items-center bg-hero px-5">{body}</div>;
}
