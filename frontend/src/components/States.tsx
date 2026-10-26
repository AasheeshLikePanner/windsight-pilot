import { AlertTriangle, RefreshCw } from "lucide-react";

export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-label="Loading" role="status">
      {Array.from({ length: lines }, (_, index) => (
        <div
          className="skeleton__line"
          key={index}
          style={{ width: `${92 - index * 9}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="notice notice--error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button className="button button--ghost" type="button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
