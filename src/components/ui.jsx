import { CircleAlert, CircleCheck, TriangleAlert, X } from 'lucide-react';

const RISK_STYLE = {
  High: { cls: 'bg-risk-high-soft text-risk-high', Icon: TriangleAlert },
  Medium: { cls: 'bg-risk-medium-soft text-risk-medium', Icon: CircleAlert },
  Low: { cls: 'bg-risk-low-soft text-risk-low', Icon: CircleCheck },
};

/** Risk is always shown as icon + word + colour, never colour alone. */
export function RiskBadge({ level, label, large = false }) {
  const { cls, Icon } = RISK_STYLE[level] || RISK_STYLE.Medium;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ${cls} ${
        large ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Icon size={large ? 15 : 13} aria-hidden="true" />
      {label}
    </span>
  );
}

export function Alert({ title, children, onDismiss, dismissLabel, action }) {
  return (
    <div
      role="alert"
      className="rise flex items-start gap-3 rounded-lg border border-risk-high/25 bg-risk-high-soft p-4 text-sm"
    >
      <TriangleAlert size={18} className="mt-0.5 shrink-0 text-risk-high" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-risk-high">{title}</p>}
        <p className="text-ink">{children}</p>
        {action}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={dismissLabel} className="icon-btn -m-2.5">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Notice({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-accent-soft p-4 text-sm text-ink">
      <CircleAlert size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
