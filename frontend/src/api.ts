// Typed client for the backend. All paths are relative (/api/...), so the same
// build works behind the Vite proxy, nginx, or a Kubernetes Ingress.

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

export interface Stats {
  total: number;
  by_status: Record<TaskStatus, number>;
  by_priority: Record<TaskPriority, number>;
  overdue: number;
  generated_at: string;
  cached: boolean;
}

export interface Activity {
  id: number;
  task_id: number;
  action: string;
  message: string;
  created_at: string;
}

export interface VersionInfo {
  version: string;
  hostname: string;
  env: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((issue: ValidationIssue) => `${issue.loc?.at(-1) ?? "field"}: ${issue.msg}`)
        .join("; ");
    }
  } catch {
    // Not JSON (for example an HTML error page from a proxy).
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return "The backend is temporarily unavailable";
  }
  return `Request failed (${response.status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the backend");
  }

  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listTasks: (status?: TaskStatus) =>
    request<Task[]>(status ? `/tasks?status=${status}` : "/tasks"),
  getTask: (id: number) => request<Task>(`/tasks/${id}`),
  createTask: (input: TaskInput) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: number, input: TaskInput) =>
    request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  stats: () => request<Stats>("/stats"),
  activity: (limit = 50) => request<Activity[]>(`/activity?limit=${limit}`),
  version: () => request<VersionInfo>("/version"),
};

export function toInput(task: Task): TaskInput {
  const { title, description, status, priority, due_date } = task;
  return { title, description, status, priority, due_date };
}
