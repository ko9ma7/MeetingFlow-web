export type View = "record" | "review" | "report" | "history" | "about";

export interface Meeting {
  id: string;
  title: string;
  meetingType: string;
  startedAt: string;
  durationSeconds: number;
  rawTranscript: string;
  transcript: string;
  report: string;
  reviewed: boolean;
  language: string;
}

export interface ReportParts {
  overview: string;
  topics: string[];
  decisions: string[];
  actionItems: string[];
  openQuestions: string[];
}
