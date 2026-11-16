import React from 'react';
import { AlertTriangle, Clock, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import type {
  BatchExpiryStatus,
  DrugClassification,
  ParetoClass,
  PaymentStatus,
  PurchaseOrderStatus,
  StockMovementType,
  UserRole,
} from '@shared/api-contracts';
import {
  type BadgeVisualMeta,
  getBatchStatusMeta,
  getDrugClassMeta,
  getMovementTypeMeta,
  getParetoClassMeta,
  getPaymentStatusMeta,
  getPurchaseOrderStatusMeta,
  getRoleMeta,
  getSipaStatusMeta,
} from '@/lib/formatters';

export type StatusBadgeKind =
  | 'batch'
  | 'pareto'
  | 'drug'
  | 'sipa'
  | 'role'
  | 'movement'
  | 'po'
  | 'payment'
  | 'custom';

export type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ink';

export interface StatusBadgeProps {
  kind?: StatusBadgeKind;
  tone?: SemanticTone;
  variant?: SemanticTone | StatusBadgeKind;
  status?:
    | BatchExpiryStatus
    | ParetoClass
    | DrugClassification
    | UserRole
    | StockMovementType
    | PurchaseOrderStatus
    | PaymentStatus
    | string;
  paretoClass?: ParetoClass;
  classification?: DrugClassification;
  role?: UserRole;
  movementType?: StockMovementType;
  isSipaActive?: boolean;
  sipaExpiryDate?: string | null;
  daysUntilExpiry?: number;
  label?: string;
  children?: React.ReactNode;
  showDot?: boolean;
  compact?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

function getToneMeta(tone: SemanticTone, label: string): BadgeVisualMeta {
  switch (tone) {
    case 'success':
      return {
        label,
        bgHex: '#B6D8C0',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-mint text-ink border-line-input',
      };
    case 'warning':
      return {
        label,
        bgHex: '#ECDBBC',
        textHex: '#7A3E0C',
        borderHex: '#7D9788',
        dotHex: '#C2610F',
        className: 'bg-cream text-warn-ink border-line-input',
      };
    case 'danger':
      return {
        label,
        bgHex: '#FCE4E0',
        textHex: '#9F1F14',
        borderHex: '#B42318',
        dotHex: '#B42318',
        className: 'bg-danger-soft text-danger-ink border-danger',
      };
    case 'info':
      return {
        label,
        bgHex: '#C8D9BF',
        textHex: '#16281F',
        borderHex: '#7D9788',
        dotHex: '#2F6B4C',
        className: 'bg-sage text-ink border-line-input',
      };
    case 'ink':
      return {
        label,
        bgHex: '#16281F',
        textHex: '#FFFFFF',
        borderHex: '#16281F',
        dotHex: '#B6D8C0',
        className: 'bg-ink text-white border-ink',
      };
    case 'neutral':
    default:
      return {
        label,
        bgHex: '#E9F3EC',
        textHex: '#5A7164',
        borderHex: '#DCE6DE',
        dotHex: '#7D9788',
        className: 'bg-sunken text-ink-muted border-line',
      };
  }
}

export function StatusBadge({
  kind,
  tone,
  variant,
  status,
  paretoClass,
  classification,
  role,
  movementType,
  isSipaActive,
  sipaExpiryDate,
  daysUntilExpiry,
  label,
  children,
  showDot = false,
  compact = false,
  className = '',
  icon,
}: StatusBadgeProps) {
  let meta: BadgeVisualMeta;
  let dynamicIcon: React.ReactNode = icon;

  if (kind === 'pareto' || paretoClass || status === 'A' || status === 'B' || status === 'C') {
    const pClass = (paretoClass || status || 'C') as ParetoClass;
    meta = getParetoClassMeta(pClass);
  } else if (kind === 'batch' || status === 'ACTIVE' || status === 'NEAR_EXPIRY' || status === 'EXPIRED') {
    const bStatus = (status || 'ACTIVE') as BatchExpiryStatus;
    meta = getBatchStatusMeta(bStatus, daysUntilExpiry);
    if (!dynamicIcon) {
      if (bStatus === 'EXPIRED' || (daysUntilExpiry !== undefined && daysUntilExpiry <= 0)) {
        dynamicIcon = <XCircle className="h-3.5 w-3.5" />;
      } else if (daysUntilExpiry !== undefined && daysUntilExpiry < 30) {
        dynamicIcon = <AlertTriangle className="h-3.5 w-3.5 text-warn-ink" />;
      } else if (daysUntilExpiry !== undefined && daysUntilExpiry < 90) {
        dynamicIcon = <Clock className="h-3.5 w-3.5 text-warn-ink" />;
      }
    }
  } else if (kind === 'drug' || classification) {
    const dClass = (classification || status || 'BEBAS') as DrugClassification;
    meta = getDrugClassMeta(dClass);
  } else if (kind === 'sipa' || isSipaActive !== undefined) {
    meta = getSipaStatusMeta(Boolean(isSipaActive), sipaExpiryDate, role);
    if (!dynamicIcon) {
      if (isSipaActive) {
        dynamicIcon = <ShieldCheck className="h-3.5 w-3.5 text-ink" />;
      } else {
        dynamicIcon = <ShieldAlert className="h-3.5 w-3.5 text-danger-ink" />;
      }
    }
  } else if (kind === 'role' || role || status === 'OWNER' || status === 'PHARMACIST' || status === 'CASHIER') {
    const uRole = (role || status || 'CASHIER') as UserRole;
    meta = getRoleMeta(uRole);
  } else if (kind === 'movement' || movementType) {
    const mType = (movementType || status || 'IN_INVOICE') as StockMovementType;
    meta = getMovementTypeMeta(mType);
  } else if (kind === 'po' && status) {
    meta = getPurchaseOrderStatusMeta(status as PurchaseOrderStatus);
  } else if (kind === 'payment' && status) {
    meta = getPaymentStatusMeta(status as PaymentStatus);
  } else if (tone) {
    meta = getToneMeta(tone, label || String(status || ''));
  } else if (variant) {
    meta = getToneMeta(variant as SemanticTone, label || String(status || ''));
  } else {
    meta = {
      label: label || String(status || ''),
      bgHex: '#E9F3EC',
      textHex: '#16281F',
      borderHex: '#DCE6DE',
      dotHex: '#7D9788',
      className: 'bg-sunken text-ink border-line',
    };
  }

  const displayContent = children || label || meta.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-normal ${
        compact ? 'h-5 px-2 text-[11px]' : 'h-6'
      } ${meta.className} ${className}`}
      aria-label={typeof displayContent === 'string' ? displayContent : undefined}
    >
      {dynamicIcon ? (
        <span className="shrink-0">{dynamicIcon}</span>
      ) : showDot ? (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: meta.dotHex }}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{displayContent}</span>
    </span>
  );
}

export function ParetoClassBadge({
  paretoClass,
  compact,
  className,
}: {
  paretoClass: ParetoClass;
  compact?: boolean;
  className?: string;
}) {
  return <StatusBadge kind="pareto" paretoClass={paretoClass} compact={compact} className={className} />;
}

export function SipaStatusBadge({
  isSipaActive,
  sipaExpiryDate,
  role,
  compact,
  className,
}: {
  isSipaActive: boolean;
  sipaExpiryDate?: string | null;
  role?: UserRole;
  compact?: boolean;
  className?: string;
}) {
  return (
    <StatusBadge
      kind="sipa"
      isSipaActive={isSipaActive}
      sipaExpiryDate={sipaExpiryDate}
      role={role}
      compact={compact}
      className={className}
    />
  );
}

