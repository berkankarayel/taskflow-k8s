import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  VERSION_ROUTE,
  fakeApi,
  makeActivity,
  makeStats,
  makeTask,
  renderApp,
} from "./test/fakeApi";

const location = () => screen.getByTestId("location").textContent;

describe("footer", () => {
  it("shows the backend version and the pod that answered", async () => {
    fakeApi({ ...VERSION_ROUTE, "GET /api/stats": { body: makeStats() }, "GET /api/activity": { body: [] } });
    renderApp("/");

    expect(await screen.findByText("backend-7d9f-abcde")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("says so when the backend is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp("/activity");
    expect(await screen.findByText("Backend unreachable")).toBeInTheDocument();
  });
});

describe("dashboard", () => {
  it("shows counts, completion, cache source and recent activity", async () => {
    fakeApi({
      ...VERSION_ROUTE,
      "GET /api/stats": { body: makeStats({ cached: true }) },
      "GET /api/activity": { body: [makeActivity({ message: "Task created: Ship it" })] },
    });
    renderApp("/");

    expect(await screen.findByText("Served from Redis cache")).toBeInTheDocument();
    const counts = screen.getByRole("region", { name: "Task counts" });
    expect(within(counts).getByText("Total tasks").parentElement).toHaveTextContent("4");
    expect(within(counts).getByText("Overdue").parentElement).toHaveTextContent("1");
    expect(screen.getByRole("img", { name: "25% done" })).toBeInTheDocument();
    expect(await screen.findByText("Task created: Ship it")).toBeInTheDocument();
  });

  it("shows an error banner with retry when the API is down", async () => {
    let healthy = false;
    fakeApi({
      ...VERSION_ROUTE,
      "GET /api/stats": () =>
        healthy ? { body: makeStats() } : { status: 503, body: { detail: "Database unavailable" } },
      "GET /api/activity": { body: [] },
    });
    renderApp("/");

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");

    healthy = true;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("tasks page", () => {
  it("lists tasks and filters by status through the URL", async () => {
    const calls = fakeApi({
      ...VERSION_ROUTE,
      "GET /api/tasks": (_, url) =>
        url.searchParams.get("status") === "done"
          ? { body: [makeTask({ id: 2, title: "Finished", status: "done" })] }
          : { body: [makeTask(), makeTask({ id: 2, title: "Finished", status: "done" })] },
    });
    renderApp("/tasks");

    expect(await screen.findByText("Write the backend Deployment")).toBeInTheDocument();
    expect(screen.getByText("2 tasks")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Done" }));

    await waitFor(() => expect(screen.queryByText("Write the backend Deployment")).toBeNull());
    expect(location()).toBe("/tasks?status=done");
    expect(calls.map((c) => c.path)).toContain("/api/tasks?status=done");
  });

  it("marks overdue tasks", async () => {
    fakeApi({ ...VERSION_ROUTE, "GET /api/tasks": { body: [makeTask({ due_date: "2020-01-01" })] } });
    renderApp("/tasks");
    expect(await screen.findByText(/overdue/)).toBeInTheDocument();
  });

  it("toggles a task to done with a full PUT", async () => {
    const task = makeTask({ description: "keep me", priority: "high" });
    const calls = fakeApi({
      ...VERSION_ROUTE,
      "GET /api/tasks": { body: [task] },
      "PUT /api/tasks/1": (body) => ({ body: { ...task, ...(body as object) } }),
    });
    renderApp("/tasks");

    await userEvent.click(await screen.findByRole("button", { name: /as done/ }));

    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      title: task.title,
      description: "keep me",
      status: "done",
      priority: "high",
      due_date: null,
    });
  });

  it("deletes a task after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const calls = fakeApi({
      ...VERSION_ROUTE,
      "GET /api/tasks": { body: [makeTask()] },
      "DELETE /api/tasks/1": { status: 204 },
    });
    renderApp("/tasks");

    await userEvent.click(await screen.findByRole("button", { name: /^Delete/ }));

    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    expect(window.confirm).toHaveBeenCalled();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const calls = fakeApi({ ...VERSION_ROUTE, "GET /api/tasks": { body: [makeTask()] } });
    renderApp("/tasks");

    await userEvent.click(await screen.findByRole("button", { name: /^Delete/ }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("shows an empty state", async () => {
    fakeApi({ ...VERSION_ROUTE, "GET /api/tasks": { body: [] } });
    renderApp("/tasks");
    expect(await screen.findByText("No tasks yet")).toBeInTheDocument();
  });
});

describe("task form", () => {
  it("creates a task and returns to the list", async () => {
    const calls = fakeApi({
      ...VERSION_ROUTE,
      "POST /api/tasks": (body) => ({ status: 201, body: makeTask(body as object) }),
      "GET /api/tasks": { body: [] },
    });
    renderApp("/tasks/new");

    await userEvent.type(screen.getByLabelText("Title"), "  Configure Ingress  ");
    await userEvent.type(screen.getByLabelText(/Description/), "taskflow.local");
    await userEvent.click(screen.getByLabelText("High"));
    await userEvent.click(screen.getByLabelText("In progress"));
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(location()).toBe("/tasks"));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      title: "Configure Ingress",
      description: "taskflow.local",
      status: "in_progress",
      priority: "high",
      due_date: null,
    });
  });

  it("requires a title and does not submit without one", async () => {
    const calls = fakeApi(VERSION_ROUTE);
    renderApp("/tasks/new");

    await userEvent.type(screen.getByLabelText("Title"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows server errors and stays on the form", async () => {
    fakeApi({
      ...VERSION_ROUTE,
      "POST /api/tasks": { status: 503, body: { detail: "Database unavailable" } },
    });
    renderApp("/tasks/new");

    await userEvent.type(screen.getByLabelText("Title"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
    expect(location()).toBe("/tasks/new");
  });

  it("loads an existing task and saves changes with PUT", async () => {
    const task = makeTask({ id: 7, title: "Old title", due_date: "2026-12-31" });
    const calls = fakeApi({
      ...VERSION_ROUTE,
      "GET /api/tasks/7": { body: task },
      "PUT /api/tasks/7": (body) => ({ body: { ...task, ...(body as object) } }),
      "GET /api/tasks": { body: [] },
    });
    renderApp("/tasks/7/edit");

    const title = await screen.findByDisplayValue("Old title");
    await userEvent.clear(title);
    await userEvent.type(title, "New title");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(location()).toBe("/tasks"));
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({
      title: "New title",
      due_date: "2026-12-31",
    });
  });

  it("shows an error for a task that does not exist", async () => {
    fakeApi({ ...VERSION_ROUTE, "GET /api/tasks/99": { status: 404, body: { detail: "Task not found" } } });
    renderApp("/tasks/99/edit");
    expect(await screen.findByRole("alert")).toHaveTextContent("Task not found");
  });
});

describe("activity page", () => {
  it("lists activity newest first as delivered by the API", async () => {
    fakeApi({
      ...VERSION_ROUTE,
      "GET /api/activity": {
        body: [
          makeActivity({ id: 2, action: "deleted", message: "Task deleted: B" }),
          makeActivity({ id: 1, action: "created", message: "Task created: A" }),
        ],
      },
    });
    renderApp("/activity");

    const items = await screen.findAllByRole("listitem");
    expect(items.map((li) => li.querySelector(".timeline-message")?.textContent)).toEqual([
      "Task deleted: B",
      "Task created: A",
    ]);
  });
});

describe("routing", () => {
  it("shows a not found page for unknown paths", async () => {
    fakeApi(VERSION_ROUTE);
    renderApp("/nope");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
