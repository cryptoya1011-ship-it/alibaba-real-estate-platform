import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../App";
import PublicPropertyPage from "../features/public-property";
import { ThemeProvider } from "../state/theme";
import { installFetchMock, sessionNoOrg } from "./mock-api";

async function expectText(text: string) {
  await waitFor(() => expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0), { timeout: 4000 });
}

function renderApp(route = "/") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  installFetchMock();
});

describe("app shell", () => {
  it("renders the tenant shell with all 12 destinations available", async () => {
    renderApp("/");
    // Brand + today's property list arrive from the mocked API
    await expectText("املاک علی‌بابا");
    await expectText("آپارتمان ۱۲۰ متری مرداویج با پارکینگ");
    await expectText("ویلا دوبلکس با استخر");

    // bottom navigation + sidebar destinations
    for (const label of ["املاک", "مشتریان", "بازدیدها", "معاملات", "بیشتر"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    // notification bell and organization chip
    expect(screen.getByLabelText("اعلان‌ها")).toBeInTheDocument();
    expect(screen.getAllByText("املاک علی‌بابا اصفهان").length).toBeGreaterThan(0);
  });

  it("shows the organization gate when the user has no organization and creates one with proper inputs", async () => {
    installFetchMock({ "POST /auth/dev-login": sessionNoOrg });
    const user = userEvent.setup();
    renderApp("/");

    await expectText("انتخاب سازمان");
    await expectText("هنوز عضوی از هیچ سازمانی نیستید");

    await user.click(screen.getByRole("button", { name: /ساخت سازمان جدید/ }));
    expect(await screen.findByText("شناسه انگلیسی (slug)")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("نام سازمان"), "املاک علی‌بابا اصفهان");
    await user.type(screen.getByPlaceholderText("alibaba-isf"), "alibaba-isf");
    await user.click(screen.getByRole("button", { name: "ثبت سازمان" }));

    // after creation the shell takes over
    await expectText("املاک علی‌بابا");
  });

  it.each([
    ["/crm", "مشتریان", "رضا محمدی"],
    ["/visits", "بازدیدها", "زمان‌بندی بازدید"],
    ["/deals", "معاملات", "مرحله بعد"],
    ["/favorites", "علاقه‌مندی‌ها", "لیست علاقه‌مندی خالی است"],
    ["/notifications", "اعلان‌ها", "بازدید جدید ثبت شد"],
    ["/public", "پلتفرم عمومی", "آپارتمان ۱۲۰ متری مرداویج با پارکینگ"],
    ["/team", "تیم و دعوت‌ها", "پذیرش دعوت با توکن"],
    ["/roles", "نقش‌ها و مجوزها", "مدیر فروش"],
    ["/ai", "هوش مصنوعی", "جستجوی زبان طبیعی"],
    ["/integrations", "یکپارچه‌سازی", "ارسال پیام تلگرام"],
  ])("renders %s with its content", async (route, heading, expected) => {
    renderApp(route);
    await expectText(heading);
    await expectText(expected);
  });

  it("renders the super-admin dashboard with global stats", async () => {
    renderApp("/admin");
    await expectText("سوپر ادمین");
    await expectText("سازمان‌ها");
    await expectText("کاربران");
  });
});

describe("public deep link", () => {
  it("renders the public property page for /p/:code without authentication", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/p/AREP-ISF-MJ-AP-S-2609-00001"]}>
          <Routes>
            <Route path="/p/:code" element={<PublicPropertyPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    await expectText("آپارتمان ۱۲۰ متری مرداویج با پارکینگ");
    await expectText("۱۵ میلیارد تومان");
    await expectText("ورود به اپ");
    await expectText("توضیحات");
  });

  it("shows a friendly empty state for an unknown code", async () => {
    installFetchMock({ "GET /public/properties/by-code/UNKNOWN-CODE": null, "GET /public/properties": [] });
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/p/UNKNOWN-CODE"]}>
          <Routes>
            <Route path="/p/:code" element={<PublicPropertyPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await expectText("ملک پیدا نشد یا منتشر نشده است");
  });
});
