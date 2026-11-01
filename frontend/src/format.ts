import type { Task, TaskPriority, TaskStatus } from "./api";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as TaskPriority[];

export function isStatus(value: string | null): value is TaskStatus {
  return value !== null && value in STATUS_LABELS;
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isOverdue(task: Pick<Task, "due_date" | "status">, today = todayISO()): boolean {
  return task.due_date !== null && task.due_date < today && task.status !== "done";
}

/** "2026-12-31" -> "Dec 31, 2026" (no time zone shift for date-only values). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Backend timestamps without an offset are UTC. */
export function parseTimestamp(value: string): Date {
  const normalized = value.replace(" ", "T");
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}Z`);
}

export function formatDateTime(value: string): string {
  return parseTimestamp(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(value: string, now: number = Date.now()): string {
  const seconds = Math.round((parseTimestamp(value).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDateTime(value);
}
