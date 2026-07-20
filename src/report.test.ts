import { describe, expect, it } from "vitest";
import { buildReportParts, createLocalReport } from "./report";

describe("local report", () => {
  it("keeps decisions and action items grounded in the transcript", () => {
    const transcript = "[00:00:01] 새 디자인을 선택하기로 합의했습니다. 민수님이 금요일까지 시안을 공유해야 합니다. 예산은 추가 검토가 필요합니다.";
    const result = buildReportParts(transcript);

    expect(result.decisions.join(" ")).toContain("합의");
    expect(result.actionItems.join(" ")).toContain("금요일");
    expect(result.openQuestions.join(" ")).toContain("추가 검토");
  });

  it("marks the report as a rule-based draft", () => {
    expect(createLocalReport("주간 회의", "진행 상황을 공유했습니다.")).toContain("규칙 기반으로 만든 초안");
  });
});
