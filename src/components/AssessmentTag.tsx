import { CheckCircle2, AlertTriangle, HelpCircle, ShieldAlert, MinusCircle } from 'lucide-react';
import { AssessmentLabel } from '../types/api';

const CONFIG: Record<AssessmentLabel, { label: string; colorClass: string; Icon: typeof CheckCircle2 }> = {
  LIKELY_CREDIBLE: {
    label: 'Likely credible',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  POTENTIALLY_MISLEADING: {
    label: 'Potentially misleading',
    colorClass: 'text-rose-700 dark:text-rose-400',
    Icon: ShieldAlert,
  },
  NEEDS_VERIFICATION: {
    label: 'Needs verification',
    colorClass: 'text-amber-700 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Insufficient evidence',
    colorClass: 'text-slate-600 dark:text-slate-400',
    Icon: HelpCircle,
  },
  ANALYSIS_UNAVAILABLE: {
    label: 'Analysis unavailable',
    colorClass: 'text-slate-500 dark:text-slate-400',
    Icon: MinusCircle,
  },
};

export function AssessmentTag({
  label,
  displayLabel,
  size = 'sm',
}: {
  label: AssessmentLabel;
  displayLabel?: string;
  size?: 'sm' | 'lg';
}) {
  const cfg = CONFIG[label] || CONFIG.NEEDS_VERIFICATION;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${cfg.colorClass} ${
        size === 'lg' ? 'text-base' : 'text-xs'
      }`}
    >
      <Icon className={size === 'lg' ? 'w-5 h-5 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden="true" />
      <span>{displayLabel || cfg.label}</span>
    </span>
  );
}
