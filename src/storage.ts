import type { Meeting } from "./types";

const STORAGE_KEY = "meetingflow-web.meetings.v1";

export function loadMeetings(): Meeting[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Meeting[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMeetings(meetings: Meeting[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}
