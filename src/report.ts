import type { ReportParts } from "./types";

const normalize = (text: string) => text.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/gm, "").replace(/\s+/g, " ").trim();

export function buildReportParts(transcript: string): ReportParts {
  const sentences = normalize(transcript)
    .split(/(?<=[.!?。]|다\.)\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 5);

  const decisions = sentences.filter((item) => /결정|확정|합의|진행하기로|선택/.test(item)).slice(0, 5);
  const actionItems = sentences.filter((item) => /담당|까지|해야|하기로|준비|확인|공유|전달/.test(item)).slice(0, 6);
  const openQuestions = sentences.filter((item) => /\?|미정|추가 검토|확인 필요|논의 필요/.test(item)).slice(0, 5);
  const topics = sentences.filter((item) => !decisions.includes(item) && !actionItems.includes(item)).slice(0, 4);

  return {
    overview: sentences.slice(0, 2).join(" ") || "검토한 전사 내용이 아직 없습니다.",
    topics,
    decisions,
    actionItems,
    openQuestions,
  };
}

const bullets = (items: string[], empty: string) => items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;

export function createLocalReport(title: string, transcript: string): string {
  const parts = buildReportParts(transcript);
  return `# ${title}\n\n## 회의 개요\n\n${parts.overview}\n\n## 주요 논의\n\n${bullets(parts.topics, "별도로 분류된 논의가 없습니다.")}\n\n## 결정사항\n\n${bullets(parts.decisions, "명시적으로 확인된 결정사항이 없습니다.")}\n\n## 실행 항목\n\n${bullets(parts.actionItems, "담당자와 기한이 확인된 실행 항목이 없습니다.")}\n\n## 미해결 질문\n\n${bullets(parts.openQuestions, "명시적으로 확인된 미해결 질문이 없습니다.")}\n\n---\n이 문서는 브라우저에서 규칙 기반으로 만든 초안입니다. 원문과 대조해 사실관계를 확인하세요.`;
}
