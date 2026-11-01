import type { ReactNode } from "react";
import type { TaskPriority, TaskStatus } from "../api";
import { PRIORITY_LABELS, STATUS_LABELS } from "../format";
import { Icon, type IconName } from "./Icon";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`badge priority-${priority}`}>
      <Icon name="flame" size={12} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function ErrorBanner({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="banner banner-error" role="alert">
      <Icon name="alert" />
      <span>{error.message}</span>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={26} />
      </div>
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}
