import type { Activity } from "../api";
import { formatDateTime, timeAgo } from "../format";
import { Icon, type IconName } from "./Icon";

const ACTION_ICONS: Record<string, IconName> = {
  created: "plus",
  updated: "edit",
  deleted: "trash",
};

export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.id} className={`timeline-item action-${item.action}`}>
          <span className="timeline-icon">
            <Icon name={ACTION_ICONS[item.action] ?? "activity"} size={14} />
          </span>
          <div className="timeline-body">
            <p className="timeline-message">{item.message}</p>
            <p className="timeline-meta">
              <span className="mono">#{item.task_id}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                {timeAgo(item.created_at)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
