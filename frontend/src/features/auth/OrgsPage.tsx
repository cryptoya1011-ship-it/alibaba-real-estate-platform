import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Plus } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Brand } from "@/components/layout/Brand";
import { ThemeToggle } from "@/components/layout/TopbarActions";
import { OrgList } from "@/components/layout/OrgSwitcher";
import { CreateOrgForm } from "./CreateOrgForm";
import { Building } from "lucide-react";

export function OrgsPage() {
  const { session, logout } = useSession();
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const hasOrgs = (session?.organizations.length ?? 0) > 0;
  const [showCreate, setShowCreate] = useState(!hasOrgs);
  useEffect(() => setShowCreate(!hasOrgs), [hasOrgs]);

  const next = params.get("next");
  if (done && session?.organization_id) return <Navigate to={next && next.startsWith("/") ? next : "/app"} replace />;

  return (
    <div className="min-h-dvh bg-hero">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pb-2 pt-5 pt-safe">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout} aria-label="خروج">
            <LogOut aria-hidden />
          </Button>
        </div>
      </header>
      <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-6">
        <div>
          <h1 className="text-display font-bold">سلام {session?.user.display_name} 👋</h1>
          <p className="text-body text-muted-foreground">
            {hasOrgs ? "سازمانی که می‌خواهید با آن کار کنید را انتخاب کنید." : "برای شروع، اولین سازمان (دفتر املاک) خود را بسازید."}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>سازمان‌های شما</CardTitle>
                <CardDescription>با انتخاب، توکن جدید برای همان سازمان صادر می‌شود</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {hasOrgs ? (
                <OrgList onSelected={() => setDone(true)} />
              ) : (
                <EmptyState icon={Building} title="هنوز عضو سازمانی نیستید" description="یک سازمان بسازید یا با توکن دعوت به تیمی بپیوندید." />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>سازمان جدید</CardTitle>
                <CardDescription>شما مالک و مدیر سازمان خواهید بود</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {showCreate ? (
                <CreateOrgForm onDone={() => setDone(true)} />
              ) : (
                <Button variant="secondary" block onClick={() => setShowCreate(true)}>
                  <Plus aria-hidden />
                  ساخت سازمان جدید
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.main>
    </div>
  );
}
