import { useCallback, useEffect, useState } from "react";
import { ApiError, api, setToken, type Session, getOutbox, addToOutbox, clearOutbox } from "./api";
import { getWebApp, isInsideTelegram } from "./telegram";
import { setupInstallPrompt, isStandalone, isOnline } from "./pwa";

type PropertyListItem = { id: number; code: string; title: string; property_type: string; price: number | null; city: string | null; district: string | null; primary_image?: string | null; };
type PersonItem = { id: number; first_name: string; last_name: string | null; phone: string | null; display_name: string; roles: { role: string }[]; };
type VisitItem = { id: number; property_id: number; customer_id: number; visit_date: string; visit_time: string | null; status: string; };
type DealItem = { id: number; code: string; title: string; status: string; customer_id: number; property_id?: number | null; amount: number | null; commission_total: number | null; };
type PublicProperty = { id: number; code: string; title: string; description: string | null; property_type: string; transaction_type: string; price: number | null; built_area: number | null; city: string | null; district: string | null; primary_image: string | null; images: string[]; created_at: string; };
type InvitationItem = { id: number; organization_id: number; invited_telegram_id: number | null; invited_phone: string | null; role_code: string; status: string; created_at: string; token?: string; };
type RoleItem = { id: number; organization_id: number | null; code: string; title: string; is_system: boolean; permissions: string[]; };

function parsePublicPath(): { type: "p" | "d" | null; code: string | null } {
  const path = window.location.pathname;
  const m1 = path.match(/\/p\/([^\/\?]+)/);
  if (m1) return { type: "p", code: decodeURIComponent(m1[1]) };
  const m2 = path.match(/\/d\/([^\/\?]+)/);
  if (m2) return { type: "d", code: decodeURIComponent(m2[1]) };
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get("code") || params.get("p") || params.get("property");
  if (codeParam && path === "/" && params.get("view") === "public") return { type: "p", code: codeParam };
  return { type: null, code: null };
}

export default function App() {
  const publicPath = parsePublicPath();
  const isPublicView = publicPath.type === "p" && !!publicPath.code;

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(!isPublicView);
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [persons, setPersons] = useState<PersonItem[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [_propLoading, setPropLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePerson, setShowCreatePerson] = useState(false);
  const [showCreateVisit, setShowCreateVisit] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [tab, setTab] = useState<"properties" | "crm" | "visits" | "deals" | "favorites" | "notif" | "public" | "team" | "roles" | "admin" | "ai" | "integrations">("properties");
  const [newProp, setNewProp] = useState({ title: "", property_type: "apartment", transaction_type: "sale", built_area: 100, price: 10000000000, city_code: "ISF", district_code: "MJ" });
  const [newPerson, setNewPerson] = useState({ first_name: "", last_name: "", phone: "", role: "buyer" as any });
  const [newVisit, setNewVisit] = useState({ property_id: "", customer_id: "", visit_date: new Date().toISOString().slice(0, 10), visit_time: "10:00" });
  const [newDeal, setNewDeal] = useState({ title: "", customer_id: "", property_id: "", amount: 20000000000, commission_total: 1000000000 });

  // PWA states
  const [online, setOnline] = useState(isOnline());
  const [installPrompt, setInstallPrompt] = useState<(() => void) | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone());
  const [publicProps, setPublicProps] = useState<PublicProperty[]>([]);
  const [publicDetail, setPublicDetail] = useState<PublicProperty | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [outboxCount, setOutboxCount] = useState(getOutbox().length);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Phase 13 Multi-Tenant
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [newInvite, setNewInvite] = useState({ telegram_id: "", role_code: "agent" });
  const [newRole, setNewRole] = useState({ code: "", title: "", permissions: "property:read,property:create,customer:read" });
  const [adminOrgs, setAdminOrgs] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminOrgStats, setAdminOrgStats] = useState<Record<number, any>>({});

  // Phase 14 AI
  const [aiQuery, setAiQuery] = useState("آپارتمان 120 متری در مرداویج اصفهان با پارکینگ و آسانسور تا 15 میلیارد");
  const [aiParsed, setAiParsed] = useState<any>(null);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiProviders, setAiProviders] = useState<any>(null);
  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const [aiDesc, setAiDesc] = useState<any>(null);

  // Phase 15 Integrations
  const [intProviders, setIntProviders] = useState<any>(null);
  const [intTelegramChatId, setIntTelegramChatId] = useState("123456");
  const [intTelegramText, setIntTelegramText] = useState("سلام از املاک علی‌بابا 🏠");
  const [intSmsPhone, setIntSmsPhone] = useState("09130000000");
  const [intSmsMessage, setIntSmsMessage] = useState("کد تایید شما: 123456");
  const [intMapsAddress, setIntMapsAddress] = useState("اصفهان، مرداویج، خیابان آزادی");
  const [intMapsResult, setIntMapsResult] = useState<any>(null);
  const [intPaymentAmount, setIntPaymentAmount] = useState(500000);
  const [intPaymentDesc, setIntPaymentDesc] = useState("کمیسیون معامله");
  const [intLogs, setIntLogs] = useState<any[]>([]);
  const [intResults, setIntResults] = useState<any[]>([]);

  const applySession = useCallback((next: Session) => { setToken(next.access_token); setSession(next); }, []);

  const loadAll = useCallback(async () => {
    if (!session?.organization_id) return;
    setPropLoading(true);
    try {
      const [props, personsList, visitsList, dealsList, favs, notifs, unread] = await Promise.all([
        api.listProperties({ limit: 20 } as any),
        api.listPersons({ limit: 20 } as any),
        api.listVisits({ limit: 20 } as any),
        api.listDeals({ limit: 20 } as any),
        api.listFavorites(),
        api.listNotifications({ limit: 20 } as any),
        api.getUnreadCount(),
      ]);
      setProperties(props as any);
      setPersons(personsList as any);
      setVisits(visitsList as any);
      setDeals(dealsList as any);
      setFavorites(favs as any);
      setNotifications(notifs as any);
      setUnreadCount((unread as any).unread_count);
    } catch (err) { console.error(err); } finally { setPropLoading(false); }
  }, [session?.organization_id]);

  const loadPublic = useCallback(async () => {
    setPublicLoading(true);
    try {
      const list = await api.publicListProperties({ limit: 20 } as any);
      setPublicProps(list as any);
    } catch (e) { console.error("public list failed", e); } finally { setPublicLoading(false); }
  }, []);

  const loadPublicDetail = useCallback(async (code: string) => {
    setPublicLoading(true);
    try {
      const detail = await api.publicGetByCode(code);
      setPublicDetail(detail as any);
      document.title = `${(detail as any).title} — املاک علی‌بابا`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", (detail as any).description?.slice(0, 160) || (detail as any).title);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", (detail as any).title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", (detail as any).description?.slice(0, 160) || "");
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && (detail as any).primary_image) ogImage.setAttribute("content", (detail as any).primary_image);
    } catch (e) {
      console.error("public detail failed", e);
      setPublicDetail(null);
    } finally { setPublicLoading(false); }
  }, []);

  const loadTeam = useCallback(async () => {
    if (!session?.organization_id) return;
    try {
      const invs = await api.listInvitations(session.organization_id);
      setInvitations(invs as any);
    } catch (e) { console.error("load invitations", e); }
  }, [session?.organization_id]);

  const loadRoles = useCallback(async () => {
    if (!session?.organization_id) return;
    try {
      const rs = await api.listRoles(session.organization_id);
      setRoles(rs as any);
    } catch (e) { console.error("load roles", e); }
  }, [session?.organization_id]);

  const loadAdmin = useCallback(async () => {
    if (!session?.user?.is_super_admin) return;
    try {
      const [orgs, users, stats] = await Promise.all([
        api.adminListOrgs({ limit: 20 } as any),
        api.adminListUsers({ limit: 20 } as any),
        api.adminGlobalStats(),
      ]);
      setAdminOrgs(orgs as any);
      setAdminUsers(users as any);
      setAdminStats(stats as any);
    } catch (e) { console.error("admin load", e); }
  }, [session?.user?.is_super_admin]);

  const loadAIProviders = useCallback(async () => {
    if (!session?.organization_id) return;
    try {
      const prov = await api.aiListProviders();
      setAiProviders(prov as any);
    } catch (e) { console.error("ai providers", e); }
  }, [session?.organization_id]);

  const loadIntProviders = useCallback(async () => {
    if (!session?.organization_id) return;
    try {
      const prov = await api.intListProviders();
      setIntProviders(prov as any);
      const logs = await api.intListLogs({ limit: 10 } as any);
      setIntLogs(logs as any);
    } catch (e) { console.error("int providers", e); }
  }, [session?.organization_id]);

  useEffect(() => {
    setupInstallPrompt((prompt) => setInstallPrompt(() => prompt));
    setIsInstalled(isStandalone());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("arep:online" as any, onOnline);
    window.addEventListener("arep:offline" as any, onOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SKIP_WAITING") setUpdateAvailable(true);
      });
    }
    const interval = setInterval(() => {}, 10000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isPublicView && publicPath.code) {
      loadPublicDetail(publicPath.code);
      loadPublic();
      setBusy(false);
      return;
    }
    const tg = getWebApp(); tg?.ready(); tg?.expand();
    (async () => {
      try {
        if (isInsideTelegram()) applySession(await api.loginTelegram(tg!.initData));
        else applySession(await api.devLogin(1000001));
      } catch (err) { setError(err instanceof ApiError ? `${err.code}: ${err.message}` : "اتصال به سرور برقرار نشد"); } finally { setBusy(false); }
    })();
  }, [applySession, isPublicView, publicPath.code, loadPublicDetail, loadPublic]);

  useEffect(() => { if (session?.organization_id) { loadAll(); loadPublic(); loadTeam(); loadRoles(); loadAIProviders(); loadIntProviders(); } }, [session?.organization_id, loadAll, loadPublic, loadTeam, loadRoles, loadAIProviders, loadIntProviders]);
  useEffect(() => { if (session?.user?.is_super_admin) loadAdmin(); }, [session?.user?.is_super_admin, loadAdmin]);

  const chooseOrganization = async (id: number) => {
    setBusy(true);
    try { applySession(await api.selectOrganization(id)); } catch (err) { setError(err instanceof ApiError ? err.message : "خطا در انتخاب سازمان"); } finally { setBusy(false); }
  };

  const handleCreateOrg = async () => {
    const name = prompt("نام سازمان:"); const slug = prompt("شناسه (slug) انگلیسی:"); if (!name || !slug) return;
    try { const org = await api.createOrganization(name, slug, `org-${Date.now()}`); const me = await api.selectOrganization(org.id); applySession(me); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleCreateProperty = async () => {
    if (!newProp.title) { alert("عنوان الزامی است"); return; }
    if (!online) {
      addToOutbox("create_property", { title: newProp.title, property_type: newProp.property_type, transaction_type: newProp.transaction_type, built_area: Number(newProp.built_area), price: Number(newProp.price), has_parking: true, has_elevator: true, owner_name: "مالک تست", owner_phone: "09130000000", location: { city: "اصفهان", city_code: newProp.city_code, district: "مرداویج", district_code: newProp.district_code }, usages: [{ usage_type: "residential", is_primary: true }] });
      setOutboxCount(getOutbox().length);
      alert("آفلاین هستید — ملک در صف همگام‌سازی ذخیره شد (Outbox)");
      return;
    }
    try {
      const payload = { title: newProp.title, property_type: newProp.property_type, transaction_type: newProp.transaction_type, built_area: Number(newProp.built_area), price: Number(newProp.price), has_parking: true, has_elevator: true, owner_name: "مالک تست", owner_phone: "09130000000", location: { city: "اصفهان", city_code: newProp.city_code, district: "مرداویج", district_code: newProp.district_code }, usages: [{ usage_type: "residential", is_primary: true }] };
      const created = await api.createProperty(payload, `prop-${Date.now()}`);
      alert(`ملک ساخته شد: ${created.code}`); setShowCreate(false); setNewProp({ ...newProp, title: "" }); loadAll();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ثبت ملک"); }
  };

  const handleCreatePerson = async () => {
    if (!newPerson.first_name) { alert("نام الزامی است"); return; }
    try {
      const payload = { first_name: newPerson.first_name, last_name: newPerson.last_name || null, phone: newPerson.phone || null, roles: [newPerson.role] };
      const created = await api.createPerson(payload);
      alert(`مشتری ساخته شد: ${created.display_name}`); setShowCreatePerson(false); setNewPerson({ first_name: "", last_name: "", phone: "", role: "buyer" }); loadAll();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ثبت مشتری"); }
  };

  const handleCreateVisit = async () => {
    if (!newVisit.property_id || !newVisit.customer_id) { alert("ملک و مشتری الزامی است"); return; }
    try {
      const payload = { property_id: Number(newVisit.property_id), customer_id: Number(newVisit.customer_id), visit_date: newVisit.visit_date, visit_time: newVisit.visit_time, status: "scheduled", notes: "بازدید از PWA" };
      await api.createVisit(payload); alert("بازدید ثبت شد + اعلان ساخته شد"); setShowCreateVisit(false); loadAll();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ثبت بازدید"); }
  };

  const handleCreateDeal = async () => {
    if (!newDeal.title || !newDeal.customer_id) { alert("عنوان و مشتری الزامی است"); return; }
    try {
      const payload = { title: newDeal.title, customer_id: Number(newDeal.customer_id), property_id: newDeal.property_id ? Number(newDeal.property_id) : null, amount: Number(newDeal.amount), commission_total: Number(newDeal.commission_total), commission_agent_share: Number(newDeal.commission_total) / 2, commission_office_share: Number(newDeal.commission_total) / 2, status: "lead" };
      const created = await api.createDeal(payload);
      alert(`معامله ساخته شد: ${created.code}`); setShowCreateDeal(false); setNewDeal({ title: "", customer_id: "", property_id: "", amount: 20000000000, commission_total: 1000000000 }); loadAll();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ثبت معامله"); }
  };

  const handleToggleFavorite = async (propertyId: number) => {
    const isFav = favorites.some((f) => f.property_id === propertyId);
    try { if (isFav) await api.removeFavorite(propertyId); else await api.addFavorite(propertyId); loadAll(); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleDealStatus = async (dealId: number, currentStatus: string, version: number) => {
    const pipeline = ["lead", "qualification", "property_match", "visit", "negotiation", "agreement", "closed_won"];
    const idx = pipeline.indexOf(currentStatus);
    const next = idx >= 0 && idx < pipeline.length - 1 ? pipeline[idx + 1] : null;
    if (!next) { alert("معامله در مرحله نهایی است"); return; }
    try { await api.updateDeal(dealId, { status: next, version }); loadAll(); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleSyncOutbox = async () => {
    if (!online) { alert("هنوز آفلاین هستید"); return; }
    const items = getOutbox();
    if (items.length === 0) { alert("صف خالی است"); return; }
    let okCount = 0;
    for (const item of items) {
      try {
        if (item.type === "create_property") {
          await api.createProperty(item.payload, `outbox-${item.id}`);
          okCount++;
        }
      } catch (e) { console.error("outbox sync failed", e); }
    }
    clearOutbox();
    setOutboxCount(0);
    alert(`${okCount} آیتم همگام شد`);
    loadAll();
  };

  // Phase 13 handlers
  const handleCreateInvitation = async () => {
    if (!session?.organization_id) return;
    if (!newInvite.telegram_id) { alert("telegram_id الزامی است"); return; }
    try {
      const payload = { invited_telegram_id: Number(newInvite.telegram_id), role_code: newInvite.role_code };
      const created = await api.createInvitation(session.organization_id, payload);
      alert(`دعوت‌نامه ساخته شد — توکن یک بار نمایش:\n${(created as any).token}\n\nاین توکن را به کاربر بدهید تا با /invitations/accept بپذیرد (یا از UI). توکن فقط یک بار دیده می‌شود و هش شده ذخیره می‌شود.`);
      setNewInvite({ telegram_id: "", role_code: "agent" });
      loadTeam();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ساخت دعوت‌نامه"); }
  };

  const handleRevokeInvitation = async (invId: number) => {
    if (!session?.organization_id) return;
    if (!confirm("دعوت‌نامه لغو شود؟")) return;
    try { await api.revokeInvitation(session.organization_id, invId); loadTeam(); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleCreateRole = async () => {
    if (!session?.organization_id) return;
    if (!newRole.code || !newRole.title) { alert("کد و عنوان نقش الزامی است"); return; }
    try {
      const perms = newRole.permissions.split(",").map((s) => s.trim()).filter(Boolean);
      const created = await api.createRole(session.organization_id, { code: newRole.code, title: newRole.title, permission_codes: perms });
      alert(`نقش ساخته شد: ${created.code}`);
      setNewRole({ code: "", title: "", permissions: "property:read,property:create,customer:read" });
      loadRoles();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ساخت نقش"); }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!session?.organization_id) return;
    if (!confirm("نقش حذف شود؟")) return;
    try { await api.deleteRole(session.organization_id, roleId); loadRoles(); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleLoadOrgStats = async (orgId: number) => {
    try {
      const stats = await api.adminGetOrgStats(orgId);
      setAdminOrgStats((prev) => ({ ...prev, [orgId]: stats }));
    } catch (e) { console.error(e); }
  };

  // Phase 14 AI handlers
  const handleAIParse = async () => {
    if (!aiQuery.trim()) { alert("متن جستجو را وارد کنید"); return; }
    try {
      const parsed = await api.aiParseSearch(aiQuery);
      setAiParsed(parsed as any);
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در parse"); }
  };

  const handleAISearchExecute = async () => {
    if (!aiQuery.trim()) { alert("متن جستجو را وارد کنید"); return; }
    try {
      const res = await api.aiSearchExecute(aiQuery);
      setAiParsed((res as any).parsed);
      setAiResults((res as any).properties);
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در جستجو"); }
  };

  const handleAIMatchRequest = async (requestId: number) => {
    try {
      const matches = await api.aiMatchRequest(requestId);
      setAiMatches(matches as any);
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در تطبیق"); }
  };

  const handleAIMatchProperty = async (propertyId: number) => {
    try {
      const matches = await api.aiMatchProperty(propertyId);
      setAiMatches(matches as any);
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در تطبیق"); }
  };

  const handleAISuggestDesc = async (propertyId: number) => {
    try {
      const desc = await api.aiSuggestDescription(propertyId);
      setAiDesc(desc as any);
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  // Phase 15 Integrations handlers
  const handleIntTelegramSend = async () => {
    if (!intTelegramChatId.trim() || !intTelegramText.trim()) { alert("chat_id و متن الزامی است"); return; }
    try {
      const res = await api.intTelegramSend(intTelegramChatId, intTelegramText);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ارسال تلگرام"); }
  };

  const handleIntTelegramSendProperty = async (propertyId: number) => {
    if (!intTelegramChatId.trim()) { alert("chat_id الزامی است"); return; }
    try {
      const res = await api.intTelegramSendProperty(propertyId, intTelegramChatId);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleIntSmsSend = async () => {
    if (!intSmsPhone.trim() || !intSmsMessage.trim()) { alert("شماره و پیام الزامی است"); return; }
    try {
      const res = await api.intSmsSend(intSmsPhone, intSmsMessage);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در ارسال SMS"); }
  };

  const handleIntSmsOtp = async () => {
    if (!intSmsPhone.trim()) { alert("شماره الزامی است"); return; }
    try {
      const res = await api.intSmsOtp(intSmsPhone);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  const handleIntPublish = async (platform: string, propertyId: number) => {
    try {
      const res = await api.intPublishListing(platform, propertyId);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در انتشار"); }
  };

  const handleIntPaymentCreate = async () => {
    if (!intPaymentAmount || !intPaymentDesc.trim()) { alert("مبلغ و توضیح الزامی است"); return; }
    try {
      const res = await api.intCreatePayment(intPaymentAmount, intPaymentDesc);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در پرداخت"); }
  };

  const handleIntGeocode = async () => {
    if (!intMapsAddress.trim()) { alert("آدرس را وارد کنید"); return; }
    try {
      const res = await api.intGeocode(intMapsAddress);
      setIntMapsResult(res as any);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
      loadIntProviders();
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا در geocode"); }
  };

  const handleIntDistance = async () => {
    try {
      const res = await api.intDistance(32.65, 51.66, 35.68, 51.41);
      setIntResults((prev) => [res, ...prev].slice(0, 20));
    } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); }
  };

  if (isPublicView) {
    return (
      <main style={{ maxWidth: 700, margin: "0 auto", padding: 16, fontFamily: "Vazirmatn, sans-serif", direction: "rtl", background: "#F5F5F5", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ color: "#1B3A5C", margin: 0, fontSize: 18 }}>املاک علی‌بابا</h1>
          <a href="/" style={{ fontSize: 12, color: "#1B3A5C", textDecoration: "none", border: "1px solid #E0E0E0", padding: "6px 12px", borderRadius: 6, background: "white" }}>ورود به اپ</a>
        </div>
        {!online && <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", padding: 8, borderRadius: 8, marginBottom: 12, fontSize: 11, color: "#E65100" }}>⚠️ آفلاین — اطلاعات از کش نمایش داده می‌شود</div>}
        {publicLoading && <div style={{ padding: 16, textAlign: "center" }}>در حال بارگذاری…</div>}
        {publicDetail ? (
          <section style={{ background: "white", border: "1px solid #E0E0E0", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            {publicDetail.primary_image && <img src={publicDetail.primary_image} alt={publicDetail.title} style={{ width: "100%", maxHeight: 320, objectFit: "cover" }} />}
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 10, color: "#757575" }}>{publicDetail.code} — {publicDetail.city} {publicDetail.district}</div>
              <h2 style={{ margin: "8px 0", color: "#1B3A5C", fontSize: 16 }}>{publicDetail.title}</h2>
              <div style={{ fontSize: 13, color: "#2E7D32", fontWeight: "bold", marginBottom: 8 }}>{publicDetail.price ? `${publicDetail.price.toLocaleString()} تومان` : "قیمت توافقی"}</div>
              <div style={{ fontSize: 12, color: "#424242", lineHeight: 1.6 }}>{publicDetail.description || "توضیحی ثبت نشده"}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, background: "#F5F5F5", padding: "4px 8px", borderRadius: 12 }}>{publicDetail.property_type}</span>
                <span style={{ fontSize: 10, background: "#F5F5F5", padding: "4px 8px", borderRadius: 12 }}>{publicDetail.transaction_type}</span>
                {publicDetail.built_area && <span style={{ fontSize: 10, background: "#F5F5F5", padding: "4px 8px", borderRadius: 12 }}>{publicDetail.built_area} متر</span>}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(publicDetail.title)}`} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#1B3A5C", color: "white", padding: "10px", borderRadius: 8, textDecoration: "none", fontSize: 12 }}>اشتراک در تلگرام</a>
                <button onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => alert("لینک کپی شد"))} style={{ flex: 1, background: "white", border: "1px solid #E0E0E0", padding: "10px", borderRadius: 8, fontSize: 12 }}>کپی لینک /p/{publicDetail.code}</button>
              </div>
              <div style={{ marginTop: 12, fontSize: 10, color: "#9E9E9E" }}>Deep Link: /p/{publicDetail.code} — OG + JSON-LD + SEO</div>
            </div>
          </section>
        ) : !publicLoading ? (
          <div style={{ background: "white", padding: 16, borderRadius: 8, border: "1px solid #E0E0E0", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#D32F2F" }}>ملک یافت نشد یا منتشر نشده</div>
            <div style={{ fontSize: 11, color: "#757575", marginTop: 8 }}>کد: {publicPath.code}</div>
          </div>
        ) : null}
        <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 13 }}>املاک منتشر شده (عمومی)</h3>
          {publicLoading ? <div style={{ fontSize: 11, color: "#757575" }}>در حال بارگذاری…</div> : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {publicProps.map((p) => (
                <li key={p.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, display: "flex", gap: 10 }}>
                  <div style={{ width: 60, height: 60, background: "#F5F5F5", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                    {p.primary_image ? <img src={p.primary_image} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#9E9E9E" }}>بدون عکس</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: 12, color: "#1B3A5C" }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: "#757575" }}>{p.code} — {p.city} {p.district} — {p.price ? `${p.price.toLocaleString()}` : "توافقی"}</div>
                    <div style={{ marginTop: 4 }}><a href={`/p/${p.code}`} style={{ fontSize: 10, color: "#1B3A5C", textDecoration: "none", border: "1px solid #E0E0E0", padding: "2px 8px", borderRadius: 12 }}>مشاهده /p/{p.code}</a></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#9E9E9E" }}>
          PWA {isInstalled ? "نصب شده ✓" : "قابل نصب"} — {online ? "آنلاین" : "آفلاین"} — املاک علی‌بابا
        </div>
      </main>
    );
  }

  if (busy) return <main style={{ padding: 16 }}>در حال بارگذاری…</main>;
  if (error) return <main style={{ padding: 16, color: "red" }}>{error}</main>;
  if (!session) return <main style={{ padding: 16, color: "red" }}>نشست معتبر نیست</main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, fontFamily: "Vazirmatn, sans-serif", direction: "rtl", background: "#F5F5F5", minHeight: "100vh" }}>
      {!online && <div style={{ background: "#D32F2F", color: "white", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>⚠️ آفلاین — برخی قابلیت‌ها محدود است</span><span style={{ fontSize: 10, background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: 10 }}>Outbox {outboxCount}</span></div>}
      {updateAvailable && <div style={{ background: "#1B3A5C", color: "white", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>نسخه جدید موجود است</span><button onClick={() => window.location.reload()} style={{ background: "#C9A84C", color: "white", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 10 }}>به‌روزرسانی</button></div>}
      {installPrompt && !isInstalled && <div style={{ background: "white", border: "1px solid #C9A84C", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>📲 نصب اپلیکیشن روی گوشی</span><button onClick={() => { installPrompt(); setInstallPrompt(null); }} style={{ background: "#1B3A5C", color: "white", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 10 }}>نصب</button></div>}
      {outboxCount > 0 && online && <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>📦 {outboxCount} آیتم در صف همگام‌سازی</span><button onClick={handleSyncOutbox} style={{ background: "#2E7D32", color: "white", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 10 }}>همگام‌سازی</button></div>}

      <h1 style={{ color: "#1B3A5C", marginBottom: 4 }}>املاک علی‌بابا — فاز ۱۵ Integrations</h1>
      <p style={{ color: "#757575", marginTop: 0, fontSize: 11 }}>
        {session.user.display_name} | سازمان #{session.organization_id ?? "—"} | نقش‌ها: {session.roles.join(",")} | {unreadCount > 0 ? `${unreadCount} اعلان |` : ""} {online ? "آنلاین" : "آفلاین"} {isInstalled ? "| نصب شده ✓" : ""} {session.user.is_super_admin ? "| سوپر ادمین 👑" : ""} | عمومی {publicProps.length}
      </p>

      <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 13 }}>سازمان‌ها — Tenant Isolation (۴ لایه + RLS)</h2>
          <button onClick={handleCreateOrg} style={{ background: "#1B3A5C", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11 }}>+ سازمان</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {session.organizations.map((org) => (
            <button key={org.id} onClick={() => chooseOrganization(org.id)} style={{ background: session.organization_id === org.id ? "#C9A84C" : "#F5F5F5", padding: "6px 10px", borderRadius: 6, border: "1px solid #E0E0E0", fontSize: 11 }}>{org.name} {session.organization_id === org.id ? "✓" : ""}</button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#9E9E9E", marginTop: 6 }}>ایزولیشن: Context → Repository → RLS (Postgres) → Cache. دسترسی به tenant دیگر → 404 (نه 403) — Org A,B,C واقعی</div>
      </section>

      {session.organization_id && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", flexWrap: "wrap" }}>
            <button onClick={() => setTab("properties")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "properties" ? "#1B3A5C" : "white", color: tab === "properties" ? "white" : "#212121", fontSize: 10 }}>املاک ({properties.length})</button>
            <button onClick={() => setTab("crm")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "crm" ? "#1B3A5C" : "white", color: tab === "crm" ? "white" : "#212121", fontSize: 10 }}>مشتریان ({persons.length})</button>
            <button onClick={() => setTab("visits")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "visits" ? "#1B3A5C" : "white", color: tab === "visits" ? "white" : "#212121", fontSize: 10 }}>بازدید ({visits.length})</button>
            <button onClick={() => setTab("deals")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "deals" ? "#1B3A5C" : "white", color: tab === "deals" ? "white" : "#212121", fontSize: 10 }}>معاملات ({deals.length})</button>
            <button onClick={() => setTab("team")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "team" ? "#1B3A5C" : "white", color: tab === "team" ? "white" : "#212121", fontSize: 10 }}>تیم ({invitations.length})</button>
            <button onClick={() => setTab("roles")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "roles" ? "#1B3A5C" : "white", color: tab === "roles" ? "white" : "#212121", fontSize: 10 }}>نقش‌ها ({roles.length})</button>
            <button onClick={() => setTab("ai")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "ai" ? "#6A1B9A" : "#F3E5F5", color: tab === "ai" ? "white" : "#6A1B9A", fontSize: 10 }}>🤖 AI</button>
            <button onClick={() => setTab("integrations")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "integrations" ? "#1565C0" : "#E3F2FD", color: tab === "integrations" ? "white" : "#1565C0", fontSize: 10 }}>🔌 یکپارچه</button>
            <button onClick={() => setTab("public")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "public" ? "#1B3A5C" : "white", color: tab === "public" ? "white" : "#212121", fontSize: 10 }}>عمومی ({publicProps.length})</button>
            <button onClick={() => setTab("favorites")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "favorites" ? "#1B3A5C" : "white", color: tab === "favorites" ? "white" : "#212121", fontSize: 10 }}>★ ({favorites.length})</button>
            <button onClick={() => setTab("notif")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "notif" ? "#1B3A5C" : "white", color: tab === "notif" ? "white" : "#212121", fontSize: 10 }}>🔔 {unreadCount > 0 ? `(${unreadCount})` : ""}</button>
            {session.user.is_super_admin && <button onClick={() => setTab("admin")} style={{ padding: 8, borderRadius: 8, border: "none", background: tab === "admin" ? "#D32F2F" : "#FFEBEE", color: tab === "admin" ? "white" : "#D32F2F", fontSize: 10 }}>👑 ادمین</button>}
          </div>

          {tab === "team" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 13 }}>دعوت تیم — Invitation Flow (توکن هش شده، یک بار مصرف)</h2>
              <div style={{ fontSize: 10, color: "#757575", marginBottom: 8 }}>بند ۴۸ — دعوت با telegram_id/phone + نقش + branch، توکن raw فقط یک بار نمایش، ذخیره به صورت sha256، پذیرش → عضویت + نقش + branch + bump permissions_version</div>
              <div style={{ background: "#F5F5F5", padding: 10, borderRadius: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input placeholder="Telegram ID (مثلاً 123456)" value={newInvite.telegram_id} onChange={(e) => setNewInvite({ ...newInvite, telegram_id: e.target.value })} style={{ padding: 6, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1, minWidth: 120 }} />
                <select value={newInvite.role_code} onChange={(e) => setNewInvite({ ...newInvite, role_code: e.target.value })} style={{ padding: 6, borderRadius: 6, flex: 1 }}>
                  <option value="agent">agent</option>
                  <option value="branch_admin">branch_admin</option>
                  <option value="organization_admin">organization_admin</option>
                  {roles.filter((r) => !r.is_system).map((r) => <option key={r.id} value={r.code}>{r.code} (سفارشی)</option>)}
                </select>
                <button onClick={handleCreateInvitation} style={{ background: "#1B3A5C", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11 }}>+ دعوت</button>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {invitations.map((inv) => (
                  <li key={inv.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div><b>دعوت #{inv.id}</b> — {inv.invited_telegram_id ? `tg:${inv.invited_telegram_id}` : inv.invited_phone} — نقش: {inv.role_code} — <span style={{ background: inv.status === "pending" ? "#FFF8E1" : inv.status === "accepted" ? "#E8F5E9" : "#FFEBEE", padding: "2px 6px", borderRadius: 10, fontSize: 9 }}>{inv.status}</span></div>
                      {inv.status === "pending" && <button onClick={() => handleRevokeInvitation(inv.id)} style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", padding: "2px 8px", borderRadius: 6, fontSize: 9, color: "#D32F2F" }}>لغو</button>}
                    </div>
                    {inv.token && <div style={{ fontSize: 9, color: "#D32F2F", marginTop: 4, wordBreak: "break-all" }}>توکن (یک بار): {inv.token}</div>}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 12, background: "#E3F2FD", padding: 8, borderRadius: 6, fontSize: 10 }}>
                <b>پذیرش دعوت:</b> کاربر دعوت شده باید با token دعوت را بپذیرد — POST /invitations/accept → membership + role + branch + cache invalidate + permissions_version bump → نیاز به re-login
                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                  <input id="accept-token" placeholder="توکن دعوت را اینجا بچسبانید" style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #90CAF9" }} />
                  <button onClick={async () => { const el = document.getElementById("accept-token") as HTMLInputElement; const t = el?.value?.trim(); if (!t) { alert("توکن را وارد کنید"); return; } try { await api.acceptInvitation(t); alert("دعوت پذیرفته شد — لطفاً دوباره وارد شوید (permissions_version تغییر کرد)"); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); } }} style={{ background: "#1565C0", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 10 }}>پذیرش</button>
                </div>
              </div>
            </section>
          )}

          {tab === "roles" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 13 }}>نقش‌های سفارشی — Custom Roles (سازمان‌محور)</h2>
              <div style={{ fontSize: 10, color: "#757575", marginBottom: 8 }}>نقش‌های سیستمی (organization_id NULL) + سفارشی (organization_id = این سازمان). is_system=false قابل ویرایش/حذف. مجوزها از ALL_PERMISSIONS. Cache perms:{`{user}`}:{`{org}`}:{`{version}`} با TTL 5 دقیقه — پس از تغییر نقش، version bump و cache invalidate.</div>
              <div style={{ background: "#F5F5F5", padding: 10, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input placeholder="کد انگلیسی (sales_manager)" value={newRole.code} onChange={(e) => setNewRole({ ...newRole, code: e.target.value })} style={{ padding: 6, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} />
                  <input placeholder="عنوان فارسی (مدیر فروش)" value={newRole.title} onChange={(e) => setNewRole({ ...newRole, title: e.target.value })} style={{ padding: 6, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} />
                </div>
                <input placeholder="مجوزها با کاما (property:read,property:create,customer:read)" value={newRole.permissions} onChange={(e) => setNewRole({ ...newRole, permissions: e.target.value })} style={{ padding: 6, borderRadius: 6, border: "1px solid #E0E0E0" }} />
                <button onClick={handleCreateRole} style={{ background: "#1B3A5C", color: "white", padding: "8px", borderRadius: 6, border: "none", fontSize: 11 }}>+ نقش سفارشی</button>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {roles.map((r) => (
                  <li key={r.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 11, background: r.is_system ? "#FAFAFA" : "white" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div><b>{r.code}</b> — {r.title} {r.is_system ? <span style={{ fontSize: 9, background: "#E0E0E0", padding: "2px 6px", borderRadius: 10 }}>سیستمی</span> : <span style={{ fontSize: 9, background: "#E8F5E9", padding: "2px 6px", borderRadius: 10 }}>سفارشی</span>} {r.organization_id ? `(org:${r.organization_id})` : "(global)"}</div>
                      {!r.is_system && <button onClick={() => handleDeleteRole(r.id)} style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", padding: "2px 8px", borderRadius: 6, fontSize: 9, color: "#D32F2F" }}>حذف</button>}
                    </div>
                    <div style={{ fontSize: 9, color: "#757575", marginTop: 4, wordBreak: "break-all" }}>مجوزها: {r.permissions.join(", ") || "—"}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "admin" && session.user.is_super_admin && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 13, color: "#D32F2F" }}>👑 سوپر ادمین — تمام سازمان‌ها (بای‌پس RLS via get_db_public)</h2>
              {adminStats && <div style={{ background: "#FFEBEE", padding: 8, borderRadius: 6, fontSize: 11, marginBottom: 8 }}>آمار کلی: سازمان‌ها {adminStats.organizations} — کاربران {adminStats.users} — شعب {adminStats.branches} — املاک {adminStats.properties} — مشتریان {adminStats.persons} — بازدید {adminStats.visits} — معامله {adminStats.deals}</div>}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button onClick={loadAdmin} style={{ background: "#D32F2F", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 10 }}>↻ بارگذاری ادمین</button>
              </div>
              <h3 style={{ fontSize: 12, margin: "8px 0" }}>سازمان‌ها (BaseRepository بدون فیلتر tenant)</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {adminOrgs.map((org) => (
                  <li key={org.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div><b>#{org.id}</b> {org.name} — {org.slug} — {org.city_code || "—"} — {org.is_active ? "فعال" : "غیرفعال"}</div>
                      <button onClick={() => handleLoadOrgStats(org.id)} style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", padding: "2px 8px", borderRadius: 6, fontSize: 9 }}>آمار</button>
                    </div>
                    {adminOrgStats[org.id] && <div style={{ fontSize: 10, color: "#424242", marginTop: 6, background: "#FAFAFA", padding: 6, borderRadius: 6 }}>اعضا: {adminOrgStats[org.id].members_count} — شعب: {adminOrgStats[org.id].branches_count} — املاک: {adminOrgStats[org.id].properties_count} — مشتریان: {adminOrgStats[org.id].persons_count} — بازدید: {adminOrgStats[org.id].visits_count} — معامله: {adminOrgStats[org.id].deals_count}</div>}
                  </li>
                ))}
              </ul>
              <h3 style={{ fontSize: 12, margin: "12px 0 8px 0" }}>کاربران (همه tenantها)</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {adminUsers.map((u) => (
                  <li key={u.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 8, marginBottom: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
                    <div>#{u.id} {u.first_name} {u.last_name || ""} — tg:{u.telegram_id} — {u.phone || "بدون شماره"} {u.is_super_admin ? "👑" : ""}</div>
                    <button onClick={async () => { try { await api.adminToggleSuperAdmin(u.id, !u.is_super_admin); loadAdmin(); } catch (err) { alert(err instanceof ApiError ? err.message : "خطا"); } }} style={{ background: u.is_super_admin ? "#FFEBEE" : "#E8F5E9", border: "1px solid #E0E0E0", padding: "2px 8px", borderRadius: 6, fontSize: 9 }}>{u.is_super_admin ? "حذف سوپر" : "سوپر کن"}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "ai" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 13, color: "#6A1B9A" }}>🤖 AI / Automation — فاز ۱۴ — Core جدا از AI</h2>
              <div style={{ fontSize: 10, color: "#757575", marginBottom: 8 }}>
                AI Adapter قابل تعویض: mock (قانون‌محور فارسی، بدون اینترنت، deterministic) / openai / gemini / claude / local (Termux). Natural Language → Structured Query + Auto Matching Request ↔ Property + Suggest Description.
              </div>

              {aiProviders && (
                <div style={{ background: "#F3E5F5", padding: 8, borderRadius: 6, fontSize: 10, marginBottom: 10 }}>
                  <b>ارائه‌دهنده فعلی:</b> {aiProviders.current} — <b>موجود:</b> {aiProviders.available.join(", ")}
                  <div style={{ marginTop: 4 }}>
                    {Object.entries(aiProviders.details).map(([k, v]: any) => (
                      <span key={k} style={{ display: "inline-block", background: aiProviders.current === k ? "#6A1B9A" : "#E1BEE7", color: aiProviders.current === k ? "white" : "#4A148C", padding: "2px 6px", borderRadius: 10, margin: 2, fontSize: 9 }}>
                        {k}: {v.type} {v.requires_api_key ? (v.has_key ? "🔑✓" : "🔑✗") : "✓"} 
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: "#FAFAFA", padding: 10, borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>جستجوی طبیعی فارسی — Natural Language Search</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="مثال: آپارتمان 2 خوابه در مرداویج تا 20 میلیارد" style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #CE93D8", fontSize: 11 }} />
                  <button onClick={handleAIParse} style={{ background: "#9C27B0", color: "white", padding: "6px 10px", borderRadius: 6, border: "none", fontSize: 10 }}>Parse</button>
                  <button onClick={handleAISearchExecute} style={{ background: "#6A1B9A", color: "white", padding: "6px 10px", borderRadius: 6, border: "none", fontSize: 10 }}>جستجو + اجرا</button>
                </div>
                {aiParsed && (
                  <div style={{ marginTop: 10, background: "white", border: "1px solid #E1BEE7", padding: 8, borderRadius: 6, fontSize: 10 }}>
                    <div style={{ fontWeight: "bold", color: "#6A1B9A" }}>Parsed: {aiParsed.parsed_by} — confidence {aiParsed.confidence}</div>
                    <div style={{ marginTop: 4, wordBreak: "break-all", fontFamily: "monospace", fontSize: 9, background: "#F5F5F5", padding: 6, borderRadius: 4 }}>
                      {JSON.stringify(aiParsed, null, 2)}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <b>فیلترها:</b> {Object.entries(aiParsed.filters || {}).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}
                    </div>
                  </div>
                )}
                {aiResults.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 10 }}>
                    {aiResults.map((p: any) => (
                      <li key={p.id} style={{ border: "1px solid #E1BEE7", borderRadius: 6, padding: 8, marginBottom: 4, fontSize: 11 }}>
                        <b>{p.title}</b> — {p.code} — {p.price?.toLocaleString()} — {p.built_area}متر — {p.property_type}
                        <button onClick={() => handleAIMatchProperty(p.id)} style={{ marginLeft: 6, fontSize: 9, background: "#F3E5F5", border: "1px solid #CE93D8", padding: "2px 6px", borderRadius: 10 }}>تطبیق با درخواست‌ها</button>
                        <button onClick={() => handleAISuggestDesc(p.id)} style={{ marginLeft: 4, fontSize: 9, background: "#EDE7F6", border: "1px solid #B39DDB", padding: "2px 6px", borderRadius: 10 }}>توضیح AI</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ background: "#FFF8E1", padding: 10, borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>تطبیق خودکار — Auto Matching Request ↔ Property</div>
                <div style={{ fontSize: 10, color: "#757575", marginBottom: 6 }}>برای هر درخواست مشتری، املاک مطابق با score + reasons. یا برای هر ملک، درخواست‌های مطابق.</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {persons.slice(0, 3).map((per) => (
                    <button key={per.id} onClick={async () => { try { const reqs = await api.listRequests({ person_id: per.id } as any); if ((reqs as any).length > 0) handleAIMatchRequest((reqs as any)[0].id); else alert("درخواستی برای این مشتری نیست"); } catch (e) { console.error(e); } }} style={{ fontSize: 9, background: "white", border: "1px solid #FFE082", padding: "4px 8px", borderRadius: 10 }}>تطبیق درخواست‌های {per.display_name}</button>
                  ))}
                  {properties.slice(0, 3).map((prop) => (
                    <button key={prop.id} onClick={() => handleAIMatchProperty(prop.id)} style={{ fontSize: 9, background: "white", border: "1px solid #FFE082", padding: "4px 8px", borderRadius: 10 }}>تطبیق ملک {prop.title.slice(0, 15)}</button>
                  ))}
                </div>
                {aiMatches.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: 10 }}>
                    {aiMatches.map((m: any, idx: number) => (
                      <li key={idx} style={{ border: "1px solid #FFE082", borderRadius: 6, padding: 8, marginBottom: 4, fontSize: 10, background: m.matched ? "#FFFDE7" : "white" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div><b>Score: {m.score}</b> {m.matched ? "✅ مطابق" : "⚠️ نسبی"} — {m.provider}</div>
                          <div style={{ fontSize: 9, background: m.score >= 0.7 ? "#2E7D32" : m.score >= 0.5 ? "#ED6C02" : "#9E9E9E", color: "white", padding: "2px 6px", borderRadius: 10 }}>{m.score}</div>
                        </div>
                        {m.property && <div>ملک: {m.property.title} — {m.property.code} — {m.property.price?.toLocaleString()}</div>}
                        {m.request && <div>درخواست: #{m.request.id} — {m.request.property_type} — {m.request.city_code} — بودجه {m.request.budget_max?.toLocaleString()}</div>}
                        <div style={{ fontSize: 9, color: "#424242", marginTop: 4 }}>دلایل: {m.reasons.join(" | ") || "—"}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {aiDesc && (
                <div style={{ background: "#E8F5E9", padding: 10, borderRadius: 8, fontSize: 11 }}>
                  <b>توضیح پیشنهادی AI برای {aiDesc.code}:</b>
                  <div style={{ marginTop: 6, background: "white", padding: 8, borderRadius: 6, border: "1px solid #A5D6A7" }}>{aiDesc.suggested_description}</div>
                  <div style={{ fontSize: 9, color: "#757575", marginTop: 4 }}>Provider: {aiDesc.provider}</div>
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 9, color: "#9E9E9E" }}>
                AI-ready Architecture: Core (AIService) جدا از Adapter (AIProvider) — Provider قابل تعویض via AI_PROVIDER env. Mock provider قانون‌محور فارسی بدون اینترنت، deterministic، تست‌پذیر. OpenAI/Gemini/Claude/Local fallback به mock اگر کلید نباشد. Local-First → PWA → Multi-Tenant → AI.
              </div>
            </section>
          )}

          {tab === "integrations" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 13, color: "#1565C0" }}>🔌 یکپارچه‌سازی — فاز ۱۵ — Telegram / SMS / Divar / Sheypoor / Payment / Maps</h2>
              <div style={{ fontSize: 10, color: "#757575", marginBottom: 8 }}>
                هر Integration Adapter مستقل — No Vendor Lock-in — Mock deterministic بدون اینترنت — Core جدا از Integration — tenant-aware — OpenStreetMap به جای Google Maps — RLS برای لاگ‌ها
              </div>

              {intProviders && (
                <div style={{ background: "#E3F2FD", padding: 8, borderRadius: 6, fontSize: 10, marginBottom: 10 }}>
                  <b>وضعیت ارائه‌دهندگان:</b>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(intProviders.current || {}).map(([k, v]: any) => (
                      <span key={k} style={{ background: "#1565C0", color: "white", padding: "2px 8px", borderRadius: 10, fontSize: 9 }}>{k}: {Array.isArray(v) ? v.join(",") : v}</span>
                    ))}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {Object.entries(intProviders.details || {}).map(([k, v]: any) => (
                      <span key={k} style={{ display: "inline-block", background: v.has_key ? "#2E7D32" : "#9E9E9E", color: "white", padding: "2px 6px", borderRadius: 10, margin: 2, fontSize: 9 }}>{k}: {v.provider} {v.has_key ? "🔑✓" : "🔑✗"}</span>
                    ))}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>موجود:</b> {Object.entries(intProviders.available || {}).map(([k, v]: any) => `${k}=[${(v as string[]).join(",")}]`).join(" | ")}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div style={{ background: "#E8F5E9", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>📱 تلگرام — Telegram Bot</div>
                  <input placeholder="chat_id (123456 یا @username)" value={intTelegramChatId} onChange={(e) => setIntTelegramChatId(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #A5D6A7", fontSize: 10, marginBottom: 4 }} />
                  <textarea placeholder="متن پیام" value={intTelegramText} onChange={(e) => setIntTelegramText(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #A5D6A7", fontSize: 10, minHeight: 50, marginBottom: 4 }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleIntTelegramSend} style={{ flex: 1, background: "#0088CC", color: "white", padding: "6px", borderRadius: 6, border: "none", fontSize: 10 }}>ارسال پیام</button>
                    <button onClick={async () => { try { const res = await api.intTelegramDeepLink(`prop_${Date.now()}`); setIntResults((prev) => [res, ...prev].slice(0, 20)); } catch (e) { console.error(e); } }} style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", padding: "6px", borderRadius: 6, fontSize: 9 }}>Deep Link</button>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {properties.slice(0, 2).map((p) => (
                      <button key={p.id} onClick={() => handleIntTelegramSendProperty(p.id)} style={{ fontSize: 9, background: "white", border: "1px solid #A5D6A7", padding: "2px 6px", borderRadius: 10, margin: 2 }}>ارسال کارت {p.title.slice(0, 12)}</button>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#FFF3E0", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>💬 SMS — Kavenegar / Mock</div>
                  <input placeholder="موبایل 0913..." value={intSmsPhone} onChange={(e) => setIntSmsPhone(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #FFCC80", fontSize: 10, marginBottom: 4 }} />
                  <input placeholder="پیام" value={intSmsMessage} onChange={(e) => setIntSmsMessage(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #FFCC80", fontSize: 10, marginBottom: 4 }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleIntSmsSend} style={{ flex: 1, background: "#EF6C00", color: "white", padding: "6px", borderRadius: 6, border: "none", fontSize: 10 }}>ارسال SMS</button>
                    <button onClick={handleIntSmsOtp} style={{ background: "white", border: "1px solid #FFCC80", padding: "6px", borderRadius: 6, fontSize: 9 }}>OTP</button>
                  </div>
                </div>

                <div style={{ background: "#F3E5F5", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>🏠 دیوار / شیپور — Listings</div>
                  <div style={{ fontSize: 9, color: "#757575", marginBottom: 4 }}>انتشار ملک در پلتفرم‌های آگهی — هر Adapter مستقل</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {properties.slice(0, 3).map((p) => (
                      <div key={p.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 9, flex: 1 }}>{p.title.slice(0, 15)} — {p.code}</span>
                        <button onClick={() => handleIntPublish("divar", p.id)} style={{ fontSize: 8, background: "#E53935", color: "white", padding: "2px 6px", borderRadius: 10, border: "none" }}>دیوار</button>
                        <button onClick={() => handleIntPublish("sheypoor", p.id)} style={{ fontSize: 8, background: "#1E88E5", color: "white", padding: "2px 6px", borderRadius: 10, border: "none" }}>شیپور</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#E0F2F1", padding: 10, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>💳 پرداخت — Payment</div>
                  <input type="number" placeholder="مبلغ (تومان)" value={intPaymentAmount} onChange={(e) => setIntPaymentAmount(Number(e.target.value))} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #80CBC4", fontSize: 10, marginBottom: 4 }} />
                  <input placeholder="توضیح" value={intPaymentDesc} onChange={(e) => setIntPaymentDesc(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #80CBC4", fontSize: 10, marginBottom: 4 }} />
                  <button onClick={handleIntPaymentCreate} style={{ width: "100%", background: "#00695C", color: "white", padding: "6px", borderRadius: 6, border: "none", fontSize: 10 }}>ایجاد لینک پرداخت</button>
                </div>
              </div>

              <div style={{ background: "#E1F5FE", padding: 10, borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>🗺️ نقشه — Maps (OpenStreetMap / Mock)</div>
                <div style={{ fontSize: 9, color: "#757575", marginBottom: 4 }}>Geocode آدرس → lat/lng — Reverse — فاصله — OSM free بدون تحریم</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input placeholder="آدرس برای geocode" value={intMapsAddress} onChange={(e) => setIntMapsAddress(e.target.value)} style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #81D4FA", fontSize: 10 }} />
                  <button onClick={handleIntGeocode} style={{ background: "#0288D1", color: "white", padding: "6px 10px", borderRadius: 6, border: "none", fontSize: 10 }}>Geocode</button>
                  <button onClick={handleIntDistance} style={{ background: "white", border: "1px solid #81D4FA", padding: "6px", borderRadius: 6, fontSize: 9 }}>فاصله اصفهان-تهران</button>
                </div>
                {intMapsResult && (
                  <div style={{ background: "white", border: "1px solid #81D4FA", padding: 8, borderRadius: 6, fontSize: 10 }}>
                    <div><b>Lat:</b> {intMapsResult.lat} — <b>Lng:</b> {intMapsResult.lng} — <b>شهر:</b> {intMapsResult.city || "—"}</div>
                    {intMapsResult.address && <div>آدرس: {intMapsResult.address}</div>}
                    <div style={{ marginTop: 4 }}>
                      <a href={`https://www.openstreetmap.org/?mlat=${intMapsResult.lat}&mlon=${intMapsResult.lng}#map=15/${intMapsResult.lat}/${intMapsResult.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#0288D1", textDecoration: "none", border: "1px solid #81D4FA", padding: "2px 6px", borderRadius: 10 }}>مشاهده در OSM</a>
                    </div>
                  </div>
                )}
              </div>

              {intResults.length > 0 && (
                <div style={{ background: "#FAFAFA", padding: 10, borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>نتایج — Integration Results (mock deterministic)</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {intResults.slice(0, 10).map((r, idx) => (
                      <li key={idx} style={{ border: "1px solid #E0E0E0", borderRadius: 6, padding: 6, marginBottom: 4, fontSize: 9, background: r.success ? "#E8F5E9" : "#FFEBEE", wordBreak: "break-all" }}>
                        <b>{r.provider || "mock"}</b> — {r.success ? "✅" : "❌"} — {JSON.stringify(r).slice(0, 200)}
                        {r.url && <div><a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#1565C0" }}>{r.url}</a></div>}
                        {r.payment_url && <div><a href={r.payment_url} target="_blank" rel="noreferrer" style={{ color: "#00695C" }}>{r.payment_url}</a></div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ background: "#FFFDE7", padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>📋 لاگ‌ها — Integration Logs (Audit, tenant-aware, RLS)</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  <button onClick={async () => { const logs = await api.intListLogs({ limit: 20 } as any); setIntLogs(logs as any); }} style={{ background: "#FBC02D", color: "white", padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10 }}>↻ بارگذاری لاگ</button>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {intLogs.map((log) => (
                    <li key={log.id} style={{ border: "1px solid #FFF9C4", borderRadius: 6, padding: 6, marginBottom: 4, fontSize: 9, background: log.status === "success" ? "white" : "#FFEBEE" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div><b>#{log.id}</b> {log.provider} — {log.action} — {log.status} {log.entity_type ? `— ${log.entity_type}#${log.entity_id}` : ""}</div>
                        <div style={{ fontSize: 8, color: "#757575" }}>{log.created_at?.slice(0, 19)}</div>
                      </div>
                      {log.external_id && <div>external: {log.external_id} {log.external_url ? `— ${log.external_url.slice(0, 50)}` : ""}</div>}
                      {log.error_message && <div style={{ color: "#D32F2F" }}>خطا: {log.error_message}</div>}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: 10, fontSize: 9, color: "#9E9E9E" }}>
                Integrations Architecture: Core (IntegrationService) جدا از Adapter — هر نوع (Telegram, SMS, Listing, Payment, Maps) Adapter مستقل — Factory via env — Mock deterministic برای تست — Fallback اگر کلید نباشد — No Vendor Lock-in — OSM به جای Google Maps — Kavenegar generic برای SMS — Zarinpal generic برای Payment — Divar/Sheypoor generic برای Listings — لاگ همه فراخوانی‌ها در integration_logs با RLS — tenant-aware.
              </div>
            </section>
          )}

          {tab === "properties" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 13 }}>املاک</h2><button onClick={() => setShowCreate(!showCreate)} style={{ background: "#1B3A5C", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11 }}>{showCreate ? "بستن" : "+ ملک"}</button></div>
              {showCreate && (
                <div style={{ background: "#F5F5F5", padding: 12, borderRadius: 8, marginTop: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input placeholder="عنوان ملک" value={newProp.title} onChange={(e) => setNewProp({ ...newProp, title: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0" }} />
                    <div style={{ display: "flex", gap: 8 }}><select value={newProp.property_type} onChange={(e) => setNewProp({ ...newProp, property_type: e.target.value })} style={{ padding: 8, borderRadius: 6, flex: 1 }}><option value="apartment">آپارتمان</option><option value="villa">ویلا</option><option value="land">زمین</option><option value="commercial">تجاری</option></select><select value={newProp.transaction_type} onChange={(e) => setNewProp({ ...newProp, transaction_type: e.target.value })} style={{ padding: 8, borderRadius: 6, flex: 1 }}><option value="sale">فروش</option><option value="rent">اجاره</option><option value="exchange">معاوضه</option></select></div>
                    <div style={{ display: "flex", gap: 8 }}><input type="number" placeholder="متراژ" value={newProp.built_area} onChange={(e) => setNewProp({ ...newProp, built_area: Number(e.target.value) })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /><input type="number" placeholder="قیمت" value={newProp.price} onChange={(e) => setNewProp({ ...newProp, price: Number(e.target.value) })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /></div>
                    <button onClick={handleCreateProperty} style={{ background: "#C9A84C", color: "white", padding: "10px", borderRadius: 6, fontWeight: "bold", border: "none" }}>{online ? "ثبت ملک — کد AB-..." : "ذخیره آفلاین — Outbox"}</button>
                  </div>
                </div>
              )}
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>{properties.map((p) => { const isFav = favorites.some((f) => f.property_id === p.id); return <li key={p.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6 }}><div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: "bold", color: "#1B3A5C", fontSize: 12 }}>{p.title}</div><button onClick={() => handleToggleFavorite(p.id)} style={{ background: isFav ? "#C9A84C" : "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: 6, padding: "2px 8px", fontSize: 10 }}>{isFav ? "★" : "☆"}</button></div><div style={{ fontSize: 10, color: "#757575" }}>{p.code} — {p.price ? `${p.price.toLocaleString()} تومان` : "—"} — <a href={`/p/${p.code}`} style={{ color: "#1B3A5C", textDecoration: "none" }}>/p/{p.code}</a></div></li>; })}</ul>
            </section>
          )}

          {tab === "public" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 13 }}>پلتفرم عمومی — SEO + Deep Link</h2><button onClick={loadPublic} style={{ background: "#F5F5F5", border: "1px solid #E0E0E0", padding: "6px 12px", borderRadius: 6, fontSize: 11 }}>↻ بارگذاری</button></div>
              <div style={{ fontSize: 10, color: "#757575", marginTop: 4 }}>فقط منتشر شده‌ها — Public DTO — OG + JSON-LD — /p/{`{code}`} — بدون احراز هویت</div>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {publicProps.map((p) => (
                  <li key={p.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, display: "flex", gap: 10 }}>
                    <div style={{ width: 50, height: 50, background: "#F5F5F5", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                      {p.primary_image ? <img src={p.primary_image} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#9E9E9E" }}>بدون عکس</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", fontSize: 12, color: "#1B3A5C" }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: "#757575" }}>{p.code} — {p.city} {p.district} — {p.price ? `${p.price.toLocaleString()}` : "توافقی"}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <a href={`/p/${p.code}`} style={{ fontSize: 9, color: "#1B3A5C", textDecoration: "none", border: "1px solid #E0E0E0", padding: "2px 6px", borderRadius: 10 }}>/p/{p.code}</a>
                        <a href={`/api/v1/public/og/${p.code}`} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: "#757575", textDecoration: "none", border: "1px solid #E0E0E0", padding: "2px 6px", borderRadius: 10 }}>OG HTML</a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "crm" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 13 }}>مشتریان</h2><button onClick={() => setShowCreatePerson(!showCreatePerson)} style={{ background: "#1B3A5C", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11 }}>{showCreatePerson ? "بستن" : "+ مشتری"}</button></div>
              {showCreatePerson && <div style={{ background: "#F5F5F5", padding: 12, borderRadius: 8, marginTop: 12 }}><div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", gap: 8 }}><input placeholder="نام" value={newPerson.first_name} onChange={(e) => setNewPerson({ ...newPerson, first_name: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /><input placeholder="نام خانوادگی" value={newPerson.last_name} onChange={(e) => setNewPerson({ ...newPerson, last_name: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /></div><input placeholder="موبایل" value={newPerson.phone} onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0" }} /><button onClick={handleCreatePerson} style={{ background: "#C9A84C", color: "white", padding: "10px", borderRadius: 6, border: "none", fontWeight: "bold" }}>ثبت مشتری</button></div></div>}
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>{persons.map((per) => <li key={per.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6 }}><div style={{ fontWeight: "bold", fontSize: 12 }}>{per.display_name}</div><div style={{ fontSize: 10, color: "#757575" }}>{per.phone || "بدون شماره"} — {per.roles.map((r) => r.role).join(", ")}</div></li>)}</ul>
            </section>
          )}

          {tab === "visits" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 13 }}>بازدیدها</h2><button onClick={() => setShowCreateVisit(!showCreateVisit)} style={{ background: "#1B3A5C", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11 }}>{showCreateVisit ? "بستن" : "+ بازدید"}</button></div>
              {showCreateVisit && <div style={{ background: "#F5F5F5", padding: 12, borderRadius: 8, marginTop: 12 }}><div style={{ display: "flex", flexDirection: "column", gap: 8 }}><input placeholder="ID ملک" value={newVisit.property_id} onChange={(e) => setNewVisit({ ...newVisit, property_id: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0" }} /><input placeholder="ID مشتری" value={newVisit.customer_id} onChange={(e) => setNewVisit({ ...newVisit, customer_id: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0" }} /><div style={{ display: "flex", gap: 8 }}><input type="date" value={newVisit.visit_date} onChange={(e) => setNewVisit({ ...newVisit, visit_date: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /><input type="time" value={newVisit.visit_time} onChange={(e) => setNewVisit({ ...newVisit, visit_time: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /></div><button onClick={handleCreateVisit} style={{ background: "#C9A84C", color: "white", padding: "10px", borderRadius: 6, border: "none", fontWeight: "bold" }}>ثبت بازدید + اعلان</button></div></div>}
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>{visits.map((v) => <li key={v.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 12 }}><div><b>بازدید #{v.id}</b> — ملک #{v.property_id} — مشتری #{v.customer_id}</div><div style={{ fontSize: 10, color: "#757575" }}>{v.visit_date} {v.visit_time || ""} — {v.status}</div></li>)}</ul>
            </section>
          )}

          {tab === "deals" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 13 }}>معاملات — Pipeline</h2><button onClick={() => setShowCreateDeal(!showCreateDeal)} style={{ background: "#1B3A5C", color: "white", padding: "6px 12px", borderRadius: 6, border: "none", fontSize: 11 }}>{showCreateDeal ? "بستن" : "+ معامله"}</button></div>
              <div style={{ fontSize: 10, color: "#757575", marginTop: 4 }}>Lead → Qualification → Property Match → Visit → Negotiation → Agreement → Closed</div>
              {showCreateDeal && (
                <div style={{ background: "#F5F5F5", padding: 12, borderRadius: 8, marginTop: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input placeholder="عنوان معامله" value={newDeal.title} onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0" }} />
                    <div style={{ display: "flex", gap: 8 }}><input placeholder="ID مشتری" value={newDeal.customer_id} onChange={(e) => setNewDeal({ ...newDeal, customer_id: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /><input placeholder="ID ملک (اختیاری)" value={newDeal.property_id} onChange={(e) => setNewDeal({ ...newDeal, property_id: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /></div>
                    <div style={{ display: "flex", gap: 8 }}><input type="number" placeholder="مبلغ معامله" value={newDeal.amount} onChange={(e) => setNewDeal({ ...newDeal, amount: Number(e.target.value) })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /><input type="number" placeholder="کمیسیون کل" value={newDeal.commission_total} onChange={(e) => setNewDeal({ ...newDeal, commission_total: Number(e.target.value) })} style={{ padding: 8, borderRadius: 6, border: "1px solid #E0E0E0", flex: 1 }} /></div>
                    <button onClick={handleCreateDeal} style={{ background: "#C9A84C", color: "white", padding: "10px", borderRadius: 6, border: "none", fontWeight: "bold" }}>ثبت معامله — کد DL-...</button>
                  </div>
                </div>
              )}
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                {deals.map((d) => (
                  <li key={d.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: "bold", fontSize: 12, color: "#1B3A5C" }}>{d.title}</div>
                      <div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: d.status === "closed_won" ? "#2E7D32" : d.status === "closed_lost" ? "#D32F2F" : "#0288D1", color: "white" }}>{d.status}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "#757575" }}>{d.code} — مشتری #{d.customer_id} — ملک #{d.property_id || "—"} — مبلغ: {d.amount ? `${d.amount.toLocaleString()}` : "—"}</div>
                    <div style={{ fontSize: 10, color: "#9E9E9E" }}>کمیسیون: {d.commission_total ? `${d.commission_total.toLocaleString()}` : "—"}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button onClick={() => handleDealStatus(d.id, d.status, 1)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid #E0E0E0", background: "#F5F5F5" }}>مرحله بعدی →</button>
                      <button onClick={async () => { const h = await api.getDealHistory(d.id); alert(`تاریخچه ${h.length} مرحله:\n` + h.map((x: any) => `${x.from_status || "—"} → ${x.to_status}`).join("\n")); }} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid #E0E0E0" }}>تاریخچه</button>
                      <a href={`/d/${d.code}`} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid #E0E0E0", textDecoration: "none", color: "#1B3A5C" }}>/d/{d.code}</a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "favorites" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 13 }}>علاقه‌مندی‌ها</h2>
              {favorites.length === 0 ? <p style={{ color: "#757575", fontSize: 11 }}>علاقه‌مندی ندارید</p> : <ul style={{ listStyle: "none", padding: 0 }}>{favorites.map((f) => { const prop = properties.find((p) => p.id === f.property_id); return <li key={f.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 11 }}><b>{prop?.title || `ملک #${f.property_id}`}</b> — {prop?.code || ""}</li>; })}</ul>}
            </section>
          )}

          {tab === "notif" && (
            <section style={{ background: "white", border: "1px solid #E0E0E0", padding: 12, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 13 }}>اعلان‌ها {unreadCount > 0 ? `(${unreadCount})` : ""}</h2><button onClick={async () => { await api.markAllNotificationsRead(); loadAll(); }} style={{ background: "#E0E0E0", padding: "6px 10px", borderRadius: 6, border: "none", fontSize: 10 }}>خواندن همه</button></div>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>{notifications.map((n) => <li key={n.id} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 10, marginBottom: 6, background: n.is_read ? "white" : "#FFF8E1", fontSize: 11 }}><div style={{ display: "flex", justifyContent: "space-between" }}><div style={{ fontWeight: "bold" }}>{n.title}</div><div style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: n.priority === "critical" ? "#D32F2F" : n.priority === "important" ? "#ED6C02" : "#0288D1", color: "white" }}>{n.priority}</div></div><div style={{ color: "#757575", marginTop: 4 }}>{n.body || ""}</div></li>)}</ul>
            </section>
          )}
        </>
      )}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: "#9E9E9E" }}>
        فاز ۱۵ Integrations — Telegram / SMS / Divar / Sheypoor / Payment / Maps (OSM) — Adapter مستقل — Mock deterministic — No Vendor Lock-in — RLS + Audit Logs — Org A,B,C — ۴ لایه ایزولیشن — AI + PWA {isInstalled ? "نصب شده ✓" : "قابل نصب"} — {online ? "آنلاین ✓" : "آفلاین"} — Deep Links /p/{`{code}`} /d/{`{code}`} — Outbox {outboxCount}
      </div>
    </main>
  );
}
