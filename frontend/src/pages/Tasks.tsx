import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, type Task, type TaskStatus, toInput } from "../api";
import { Icon } from "../components/Icon";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  PriorityBadge,
  Skeleton,
  StatusBadge,
} from "../components/ui";
import { STATUSES, STATUS_LABELS, formatDate, isOverdue, isStatus } from "../format";
import { useAsync } from "../useAsync";

export function Tasks() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const status = isStatus(raw) ? raw : undefined;

  const tasks = useAsync(() => api.listTasks(status), [status]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);

  async function run(task: Task, action: () => Promise<unknown>) {
    setBusyId(task.id);
    setActionError(null);
    try {
      await action();
      tasks.reload();
    } catch (error) {
      setActionError(error as Error);
    } finally {
      setBusyId(null);
    }
  }

  function toggleDone(task: Task) {
    const next: TaskStatus = task.status === "done" ? "todo" : "done";
    return run(task, () => api.updateTask(task.id, { ...toInput(task), status: next }));
  }

  function remove(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    return run(task, () => api.deleteTask(task.id));
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={
          tasks.data
            ? `${tasks.data.length} ${tasks.data.length === 1 ? "task" : "tasks"}`
            : "Loading…"
        }
        actions={
          <Link to="/tasks/new" className="btn btn-primary">
            <Icon name="plus" />
            New task
          </Link>
        }
      />

      <div className="tabs" role="tablist" aria-label="Filter by status">
        {[undefined, ...STATUSES].map((value) => (
          <button
            key={value ?? "all"}
            type="button"
            role="tab"
            aria-selected={status === value}
            className="tab"
            onClick={() => setParams(value ? { status: value } : {})}
          >
            {value ? STATUS_LABELS[value] : "All"}
          </button>
        ))}
      </div>

      {actionError && <ErrorBanner error={actionError} />}
      {tasks.error && <ErrorBanner error={tasks.error} onRetry={tasks.reload} />}

      {!tasks.data ? (
        !tasks.error && <TaskListSkeleton />
      ) : tasks.data.length === 0 ? (
        <EmptyState title={status ? `No "${STATUS_LABELS[status]}" tasks` : "No tasks yet"}>
          <Link to="/tasks/new" className="btn btn-primary">
            <Icon name="plus" />
            Create your first task
          </Link>
        </EmptyState>
      ) : (
        <ul className="task-list">
          {tasks.data.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              busy={busyId === task.id}
              onToggle={() => toggleDone(task)}
              onDelete={() => remove(task)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  onDelete,
}: {
  task: Task;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "done";
  const overdue = isOverdue(task);

  return (
    <li className={`task-row ${done ? "is-done" : ""} ${busy ? "is-busy" : ""}`}>
      <button
        type="button"
        className="check"
        onClick={onToggle}
        disabled={busy}
        aria-label={done ? `Mark "${task.title}" as to do` : `Mark "${task.title}" as done`}
        aria-pressed={done}
      >
        <Icon name="check" size={14} />
      </button>

      <div className="task-main">
        <Link to={`/tasks/${task.id}/edit`} className="task-title">
          {task.title}
        </Link>
        {task.description && <p className="task-desc">{task.description}</p>}
        <div className="task-meta">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.due_date && (
            <span className={`due ${overdue ? "is-overdue" : ""}`}>
              <Icon name="calendar" size={13} />
              {formatDate(task.due_date)}
              {overdue && " · overdue"}
            </span>
          )}
        </div>
      </div>

      <div className="task-actions">
        <Link
          to={`/tasks/${task.id}/edit`}
          className="icon-btn"
          aria-label={`Edit "${task.title}"`}
          title="Edit"
        >
          <Icon name="edit" size={16} />
        </Link>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete "${task.title}"`}
          title="Delete"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}

function TaskListSkeleton() {
  return (
    <ul className="task-list" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="task-row">
          <Skeleton className="skeleton-check" />
          <div className="task-main">
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line short" />
          </div>
        </li>
      ))}
    </ul>
  );
}
