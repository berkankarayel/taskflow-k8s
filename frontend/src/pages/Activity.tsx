import { api } from "../api";
import { ActivityList } from "../components/ActivityList";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorBanner, PageHeader, Skeleton } from "../components/ui";
import { useAsync } from "../useAsync";

export function Activity() {
  const activity = useAsync(() => api.activity(50), []);

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every change, written asynchronously by the worker"
        actions={
          <button
            type="button"
            className={`btn btn-ghost ${activity.loading ? "spinning" : ""}`}
            onClick={activity.reload}
          >
            <Icon name="refresh" />
            Refresh
          </button>
        }
      />

      {activity.error && <ErrorBanner error={activity.error} onRetry={activity.reload} />}

      <div className="panel">
        {!activity.data ? (
          !activity.error && <Skeleton className="skeleton-block" />
        ) : activity.data.length === 0 ? (
          <EmptyState icon="activity" title="No activity yet">
            The backend puts every change on a Redis queue; the worker picks it up and writes
            it here. If you just changed something, refresh in a moment.
          </EmptyState>
        ) : (
          <ActivityList items={activity.data} />
        )}
      </div>
    </>
  );
}
