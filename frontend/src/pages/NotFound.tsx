import { Link } from "react-router";
import { EmptyState } from "../components/ui";

export function NotFound() {
  return (
    <EmptyState icon="alert" title="Page not found">
      <Link to="/" className="btn btn-primary">
        Go to dashboard
      </Link>
    </EmptyState>
  );
}
