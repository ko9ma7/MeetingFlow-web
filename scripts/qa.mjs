import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await desktop.goto("http://127.0.0.1:4173/MeetingFlow-web/");
  await desktop.evaluate(() => localStorage.clear());
  await desktop.reload();
  await desktop.getByRole("button", { name: "샘플로 먼저 체험" }).click();
  await desktop.getByRole("heading", { name: "전사 원문 검토" }).waitFor();
  await desktop.getByRole("button", { name: "검토 완료하고 계속" }).click();
  await desktop.getByRole("button", { name: "로컬 보고서 만들기" }).click();
  await desktop.getByText("회의록 초안", { exact: true }).waitFor();
  const report = await desktop.locator("pre").textContent();
  if (!report?.includes("결정사항") || !report.includes("금요일")) throw new Error("보고서에 근거가 반영되지 않았습니다.");
  await desktop.getByRole("button", { name: "회의 기록" }).click();
  await desktop.getByRole("heading", { name: "MeetingFlow 웹 전환 회의" }).waitFor();
  await desktop.screenshot({ path: "artifacts/screenshots/flow-complete.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto("http://127.0.0.1:4173/MeetingFlow-web/");
  const dimensions = await mobile.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  if (dimensions.scrollWidth > dimensions.innerWidth) throw new Error(`모바일 가로 넘침: ${dimensions.scrollWidth}px > ${dimensions.innerWidth}px`);
  await mobile.getByRole("button", { name: "메뉴 열기" }).click();
  await mobile.getByRole("navigation", { name: "주요 메뉴" }).waitFor();
  await mobile.screenshot({ path: "artifacts/screenshots/mobile-verified.png", fullPage: false });
  console.log("QA passed: sample review/report/history flow and 390px responsive layout");
} finally {
  await browser.close();
}
