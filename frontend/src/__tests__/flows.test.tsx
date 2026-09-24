import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { ThemeProvider } from "../state/theme";
import { getOutbox } from "../api";
import { faNum, toman, dealStageLabel } from "../lib/format";
import { installFetchMock } from "./mock-api";

function renderApp(route = "/") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

async function waitForShell() {
  await waitFor(() => expect(screen.getAllByText("آپارتمان ۱۲۰ متری مرداویج با پارکینگ").length).toBeGreaterThan(0), { timeout: 4000 });
}

beforeEach(() => {
  installFetchMock();
});

describe("formatting helpers (fa-IR)", () => {
  it("formats prices, numbers and stages in Persian", () => {
    expect(toman(15_000_000_000)).toBe("۱۵ میلیارد تومان");
    expect(toman(750_000_000)).toBe("۷۵۰ میلیون تومان");
    expect(toman(500_000)).toBe("۵۰۰٬۰۰۰ تومان");
    expect(toman(null)).toBe("توافقی");
    expect(faNum(1234)).toBe("۱٬۲۳۴");
    expect(dealStageLabel("closed_won")).toBe("قطعی شده");
    expect(dealStageLabel("qualification")).toBe("احراز نیاز");
  });
});

describe("property creation flow", () => {
  it("creates a property online through the modal form", async () => {
    const user = userEvent.setup();
    const fetchMock = installFetchMock();
    renderApp("/");
    await waitForShell();

    await user.click(screen.getAllByRole("button", { name: /ملک جدید|ثبت ملک/ })[0]);
    const title = await screen.findByPlaceholderText("عنوان ملک");
    await user.type(title, "آپارتمان ۹۰ متری سپاهان‌شهر");
    await user.click(screen.getByRole("button", { name: /ثبت ملک — کد/ }));

    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(([url, init]) => String(url).includes("/properties") && (init as RequestInit)?.method === "POST");
      expect(posts.length).toBe(1);
      const body = JSON.parse(String((posts[0][1] as RequestInit).body));
      expect(body.title).toBe("آپارتمان ۹۰ متری سپاهان‌شهر");
      expect(body.location.city_code).toBe("ISF");
      const headers = (posts[0][1] as RequestInit).headers as Headers;
      expect(headers.get("Idempotency-Key")).toContain("prop-");
    });
  });

  it("queues the property in the offline outbox when there is no connection", async () => {
    const user = userEvent.setup();
    installFetchMock();
    renderApp("/");
    await waitForShell();

    // go offline → the shell shows the offline banner
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    expect(await screen.findByText(/آفلاین هستید/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /ملک جدید|ثبت ملک/ })[0]);
    await user.type(await screen.findByPlaceholderText("عنوان ملک"), "ملک ثبت آفلاین");
    await user.click(screen.getByRole("button", { name: /ذخیره آفلاین در صف/ }));

    await waitFor(() => {
      const outbox = getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0].type).toBe("create_property");
      expect(outbox[0].payload.title).toBe("ملک ثبت آفلاین");
    });
  });
});

describe("deal pipeline", () => {
  it("advances the deal stage with optimistic locking (version) and shows the history timeline", async () => {
    const user = userEvent.setup();
    const fetchMock = installFetchMock({
      "GET /deals/1/history": [
        { id: 1, from_status: null, to_status: "lead", notes: "ایجاد معامله", created_at: "2026-09-24T14:00:40" },
        { id: 2, from_status: "lead", to_status: "qualification", notes: null, created_at: "2026-09-24T14:00:41" },
      ],
    });
    renderApp("/deals");
    await screen.findByText("معامله آپارتمان مرداویج");

    await user.click(screen.getByRole("button", { name: /مرحله بعد/ }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/deals/1") && (init as RequestInit)?.method === "PATCH");
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toMatchObject({ version: 2 });
    });

    await user.click(screen.getByRole("button", { name: /تاریخچه/ }));
    expect(await screen.findByText("ایجاد معامله")).toBeInTheDocument();
  });
});

describe("notifications", () => {
  it("marks every notification as read", async () => {
    const user = userEvent.setup();
    const fetchMock = installFetchMock();
    renderApp("/notifications");
    await screen.findByText("بازدید جدید ثبت شد");

    await user.click(screen.getByRole("button", { name: /خواندن همه/ }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes("/notifications/read-all") && (init as RequestInit)?.method === "POST")).toBe(true),
    );
  });
});

describe("search & filters", () => {
  it("sends the search term to the API (debounced) and filters by property type", async () => {
    const user = userEvent.setup();
    const fetchMock = installFetchMock();
    renderApp("/");
    await waitForShell();

    await user.type(screen.getByPlaceholderText(/جستجو در عنوان/), "مرداویج");
    await waitFor(
      () => {
        const q = fetchMock.mock.calls.some(([url]) => String(url).includes("q=%D9%85%D8%B1%D8%AF%D8%A7%D9%88%DB%8C%D8%AC") || decodeURIComponent(String(url)).includes("q=مرداویج"));
        expect(q).toBe(true);
      },
      { timeout: 3000 },
    );

    await user.selectOptions(screen.getAllByRole("combobox")[0], "villa");
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("property_type=villa"))).toBe(true));
  });
});

describe("favorites", () => {
  it("toggles a property as favorite", async () => {
    const user = userEvent.setup();
    const fetchMock = installFetchMock();
    renderApp("/");
    await waitForShell();

    const starButtons = screen.getAllByLabelText("علاقه‌مندی");
    await user.click(starButtons[0]);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => String(url).includes("/favorites") && (init as RequestInit)?.method === "POST"),
      ).toBe(true),
    );
  });
});
