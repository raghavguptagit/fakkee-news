import { CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import { AssessmentLabel, SimpleVerdict } from '../types/api';

export function resolveSimpleVerdict(label: AssessmentLabel, simpleVerdict?: SimpleVerdict): SimpleVerdict {
  if (simpleVerdict) return simpleVerdict;
  if (label === 'LIKELY_CREDIBLE') return 'likely_true';
  if (label === 'POTENTIALLY_MISLEADING') return 'likely_fake';
  return 'unverified';
}

const VERDICT_CONFIG: Record<
  SimpleVerdict,
  { label: string; colorClass: string; badgeBg: string; Icon: typeof CheckCircle2 }
> = {
  likely_true: {
    label: 'Likely True',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900',
    Icon: CheckCircle2,
  },
  likely_fake: {
    label: 'Likely Fake / Misleading',
    colorClass: 'text-rose-700 dark:text-rose-400',
    badgeBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900',
    Icon: ShieldAlert,
  },
  unverified: {
    label: 'Unverified',
    colorClass: 'text-amber-700 dark:text-amber-400',
    badgeBg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900',
    Icon: HelpCircle,
  },
};

export function AssessmentTag({
  label,
  simpleVerdict,
  displayLabel,
  size = 'sm',
}: {
  label: AssessmentLabel;
  simpleVerdict?: SimpleVerdict;
  displayLabel?: string;
  size?: 'sm' | 'lg';
}) {
  const verdict = resolveSimpleVerdict(label, simpleVerdict);
  const cfg = VERDICT_CONFIG[verdict];
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
