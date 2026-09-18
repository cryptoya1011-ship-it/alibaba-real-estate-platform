/** Thin typed wrapper around the Telegram Web App bridge. */
export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string } };
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
};

export function getWebApp(): TelegramWebApp | null {
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  return tg ?? null;
}

export function isInsideTelegram(): boolean {
  const tg = getWebApp();
  return Boolean(tg && tg.initData && tg.initData.length > 0);
}
