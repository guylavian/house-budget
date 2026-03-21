import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface AppShellProps {
  children: ReactNode;
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange';
}

export interface ExportButtonProps {
  onExport: () => Promise<void>;
  label?: string;
}

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (row: T) => string | number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
