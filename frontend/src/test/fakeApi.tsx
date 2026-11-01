import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { vi } from "vitest";
import type { Activity, Stats, Task } from "../api";
import { App } from "../App";

type Reply = { status?: number; body?: unknown };
type Handler = (body: unknown, url: URL) => Reply;

export interface FakeCall {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Replaces fetch with a tiny router: keys are "METHOD /path" (query string
 * ignored). Unknown requests get a 404 so a missing stub is obvious.
 */
export function fakeApi(routes: Record<string, Handler | Reply>) {
  const calls: FakeCall[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });

    const route = routes[`${method} ${url.pathname}`];
    const reply = typeof route === "function" ? route(body, url) : (route ?? { status: 404 });
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return calls;
}

export const VERSION_ROUTE = {
  "GET /api/version": { body: { version: "1.0.0", hostname: "backend-7d9f-abcde", env: "test" } },
};

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "Write the backend Deployment",
    description: null,
    status: "todo",
    priority: "medium",
    due_date: null,
    created_at: "2026-11-01T10:00:00+00:00",
    updated_at: "2026-11-01T10:00:00+00:00",
    ...overrides,
  };
}

export function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    total: 4,
    by_status: { todo: 2, in_progress: 1, done: 1 },
    by_priority: { low: 1, medium: 1, high: 2 },
    overdue: 1,
    generated_at: "2026-11-01T10:00:00+00:00",
    cached: false,
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    task_id: 1,
    action: "created",
    message: "Task created: Write the backend Deployment",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}
