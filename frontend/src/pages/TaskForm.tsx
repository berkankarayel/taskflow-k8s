import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, type TaskInput, type TaskPriority, type TaskStatus } from "../api";
import { Icon } from "../components/Icon";
import { ErrorBanner, PageHeader, Skeleton } from "../components/ui";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "../format";

const TITLE_MAX = 200;

interface FormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  due_date: "",
};

function validateTitle(title: string): string | null {
  if (title.trim() === "") return "Title is required";
  if (title.trim().length > TITLE_MAX) return `Title must be at most ${TITLE_MAX} characters`;
  return null;
}

function toTaskInput(form: FormState): TaskInput {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    status: form.status,
    priority: form.priority,
    due_date: form.due_date || null,
  };
}

export function TaskForm() {
  const { id } = useParams();
  const taskId = id === undefined ? null : Number(id);
  const isEdit = taskId !== null;
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (taskId === null) return;
    let cancelled = false;
    api.getTask(taskId).then(
      (task) => {
        if (cancelled) return;
        setForm({
          title: task.title,
          description: task.description ?? "",
          status: task.status,
          priority: task.priority,
          due_date: task.due_date ?? "",
        });
        setLoading(false);
      },
      (error: Error) => {
        if (cancelled) return;
        setLoadError(error);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const titleError = validateTitle(form.title);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (titleError) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input = toTaskInput(form);
      if (taskId !== null) await api.updateTask(taskId, input);
      else await api.createTask(input);
      navigate("/tasks");
    } catch (error) {
      setSaveError(error as Error);
      setSaving(false);
    }
  }

  const back = (
    <Link to="/tasks" className="btn btn-ghost">
      <Icon name="arrowLeft" />
      Back to tasks
    </Link>
  );

  if (loadError) {
    return (
      <>
        <PageHeader title="Edit task" actions={back} />
        <ErrorBanner error={loadError} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit task" : "New task"}
        subtitle={isEdit ? `Task #${taskId}` : "Add something to get done"}
        actions={back}
      />

      <form className="panel form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
        {saveError && <ErrorBanner error={saveError} />}

        <div className="field">
          <div className="field-head">
            <label htmlFor="title">Title</label>
            <span className={`counter ${form.title.length > TITLE_MAX ? "is-over" : ""}`}>
              {form.title.length}/{TITLE_MAX}
            </span>
          </div>
          {loading ? (
            <Skeleton className="skeleton-input" />
          ) : (
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Write the backend Deployment"
              aria-invalid={submitted && titleError !== null}
              aria-describedby={submitted && titleError ? "title-error" : undefined}
              autoFocus={!isEdit}
            />
          )}
          {submitted && titleError && (
            <p id="title-error" className="field-error">
              {titleError}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="description">
            Description <span className="optional">optional</span>
          </label>
          {loading ? (
            <Skeleton className="skeleton-textarea" />
          ) : (
            <textarea
              id="description"
              className="input"
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Details, links, acceptance criteria…"
            />
          )}
        </div>

        <div className="field-row">
          <fieldset className="field">
            <legend>Status</legend>
            <div className="segmented">
              {STATUSES.map((status) => (
                <label key={status} className={`segment status-${status}`}>
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    checked={form.status === status}
                    onChange={() => update("status", status)}
                    disabled={loading}
                  />
                  <span>{STATUS_LABELS[status]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Priority</legend>
            <div className="segmented">
              {PRIORITIES.map((priority) => (
                <label key={priority} className={`segment priority-${priority}`}>
                  <input
                    type="radio"
                    name="priority"
                    value={priority}
                    checked={form.priority === priority}
                    onChange={() => update("priority", priority)}
                    disabled={loading}
                  />
                  <span>{PRIORITY_LABELS[priority]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="due_date">
              Due date <span className="optional">optional</span>
            </label>
            <input
              id="due_date"
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => update("due_date", e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-actions">
          <Link to="/tasks" className="btn btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving || loading}>
            <Icon name="check" />
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </>
  );
}
