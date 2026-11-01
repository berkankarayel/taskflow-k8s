import { describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";
import { fakeApi } from "./test/fakeApi";

describe("api client", () => {
  it("sends JSON and returns the parsed body", async () => {
    const calls = fakeApi({ "POST /api/tasks": { status: 201, body: { id: 3 } } });
    const input = {
      title: "x",
      description: null,
      status: "todo",
      priority: "low",
      due_date: null,
    } as const;

    await expect(api.createTask(input)).resolves.toEqual({ id: 3 });
    expect(calls).toEqual([{ method: "POST", path: "/api/tasks", body: input }]);
  });

  it("adds the status filter to the query string", async () => {
    const calls = fakeApi({ "GET /api/tasks": { body: [] } });
    await api.listTasks("in_progress");
    expect(calls[0].path).toBe("/api/tasks?status=in_progress");
  });

  it("returns undefined for 204 No Content", async () => {
    fakeApi({ "DELETE /api/tasks/1": { status: 204 } });
    await expect(api.deleteTask(1)).resolves.toBeUndefined();
  });

  it("uses the backend's detail message", async () => {
    fakeApi({ "GET /api/tasks/9": { status: 404, body: { detail: "Task not found" } } });
    await expect(api.getTask(9)).rejects.toEqual(new ApiError(404, "Task not found"));
  });

  it("flattens FastAPI validation errors", async () => {
    fakeApi({
      "POST /api/tasks": {
        status: 422,
        body: { detail: [{ loc: ["body", "title"], msg: "String should have at most 200 characters" }] },
      },
    });
    await expect(
      api.createTask({ title: "", description: null, status: "todo", priority: "low", due_date: null }),
    ).rejects.toThrow("title: String should have at most 200 characters");
  });

  it("explains gateway errors without a JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(api.stats()).rejects.toThrow("The backend is temporarily unavailable");
  });

  it("reports network failures with status 0", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.version()).rejects.toMatchObject({ status: 0, message: "Cannot reach the backend" });
  });
});
