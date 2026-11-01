import { useLocation } from "react-router";
import { api } from "../api";
import { useAsync } from "../useAsync";
import { Icon } from "./Icon";

/**
 * Shows which backend answered. In Kubernetes the hostname is the pod name, so
 * refreshing shows Service load balancing and the version shows rollouts.
 */
export function BackendFooter() {
  const { pathname } = useLocation();
  const { data, error, loading, reload } = useAsync(() => api.version(), [pathname]);

  const state = error ? "down" : data ? "up" : "pending";

  return (
    <footer className="footer" aria-live="polite">
      <span className={`status-dot ${state}`} />
      {error ? (
        <span>Backend unreachable</span>
      ) : data ? (
        <>
          <span>
            Backend <strong>v{data.version}</strong>
          </span>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <span title="In Kubernetes this is the pod name">
            served by <code className="pod-name">{data.hostname}</code>
          </span>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <span className="footer-env">{data.env}</span>
        </>
      ) : (
        <span>Connecting…</span>
      )}
      <button
        type="button"
        className={`icon-btn icon-btn-sm ${loading ? "spinning" : ""}`}
        onClick={reload}
        title="Ask again: another pod may answer"
        aria-label="Refresh backend info"
      >
        <Icon name="refresh" size={14} />
      </button>
    </footer>
  );
}
