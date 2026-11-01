import type { CSSProperties } from "react";
import { Link } from "react-router";
import { api, type Stats } from "../api";
import { ActivityList } from "../components/ActivityList";
import { Icon, type IconName } from "../components/Icon";
import { EmptyState, ErrorBanner, PageHeader, Skeleton } from "../components/ui";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS, formatDateTime } from "../format";
import { useAsync } from "../useAsync";

export function Dashboard() {
  const stats = useAsync(() => api.stats(), []);
  const activity = useAsync(() => api.activity(6), []);
  const s = stats.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where your tasks stand right now"
        actions={s && <CacheBadge stats={s} />}
      />

      {stats.error && <ErrorBanner error={stats.error} onRetry={stats.reload} />}

      <section className="stat-grid" aria-label="Task counts">
        <StatCard label="Total tasks" value={s?.total} icon="tasks" tone="accent" to="/tasks" />
        <StatCard
          label="To do"
          value={s?.by_status.todo}
          icon="inbox"
          tone="todo"
          to="/tasks?status=todo"
        />
        <StatCard
          label="In progress"
          value={s?.by_status.in_progress}
          icon="clock"
          tone="progress"
          to="/tasks?status=in_progress"
        />
        <StatCard
          label="Done"
          value={s?.by_status.done}
          icon="check"
          tone="done"
          to="/tasks?status=done"
        />
        <StatCard label="Overdue" value={s?.overdue} icon="alert" tone="danger" />
      </section>

      <section className="panel-grid">
        <div className="panel">
          <h2 className="panel-title">Completion</h2>
          {s ? <Completion stats={s} /> : <Skeleton className="skeleton-block" />}
        </div>

        <div className="panel">
          <h2 className="panel-title">By priority</h2>
          {s ? <PriorityBars stats={s} /> : <Skeleton className="skeleton-block" />}
        </div>

        <div className="panel panel-wide">
          <div className="panel-head">
            <h2 className="panel-title">Recent activity</h2>
            <Link to="/activity" className="link">
              View all
            </Link>
          </div>
          {activity.error ? (
            <ErrorBanner error={activity.error} onRetry={activity.reload} />
          ) : !activity.data ? (
            <Skeleton className="skeleton-block" />
          ) : activity.data.length === 0 ? (
            <EmptyState icon="activity" title="No activity yet">
              Create a task and the worker will log it here.
            </EmptyState>
          ) : (
            <ActivityList items={activity.data} />
          )}
        </div>
      </section>
    </>
  );
}

function CacheBadge({ stats }: { stats: Stats }) {
  return (
    <span
      className={`cache-badge ${stats.cached ? "is-cached" : "is-live"}`}
      title={`Computed at ${formatDateTime(stats.generated_at)}`}
    >
      <Icon name={stats.cached ? "bolt" : "database"} size={14} />
      {stats.cached ? "Served from Redis cache" : "Fresh from PostgreSQL"}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  to,
}: {
  label: string;
  value: number | undefined;
  icon: IconName;
  tone: string;
  to?: string;
}) {
  const body = (
    <>
      <span className="stat-icon">
        <Icon name={icon} />
      </span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? <Skeleton className="skeleton-number" />}</span>
    </>
  );
  return to ? (
    <Link to={to} className={`stat-card tone-${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`stat-card tone-${tone}`}>{body}</div>
  );
}

function Completion({ stats }: { stats: Stats }) {
  const percent = stats.total ? Math.round((stats.by_status.done / stats.total) * 100) : 0;
  return (
    <div className="completion">
      <div
        className="ring"
        style={{ "--p": percent } as CSSProperties}
        role="img"
        aria-label={`${percent}% done`}
      >
        <span className="ring-value">{percent}%</span>
        <span className="ring-label">done</span>
      </div>
      <ul className="legend">
        {STATUSES.map((status) => (
          <li key={status}>
            <span className={`legend-dot status-${status}`} />
            <span>{STATUS_LABELS[status]}</span>
            <strong>{stats.by_status[status]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PriorityBars({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...PRIORITIES.map((p) => stats.by_priority[p]));
  return (
    <ul className="bars">
      {[...PRIORITIES].reverse().map((priority) => {
        const count = stats.by_priority[priority];
        return (
          <li key={priority} className={`bar-row priority-${priority}`}>
            <span className="bar-label">{PRIORITY_LABELS[priority]}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <strong className="bar-count">{count}</strong>
          </li>
        );
      })}
    </ul>
  );
}
