export const formatILS = (amount: number): string =>
  `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const formatDelta = (pct: number): string =>
  `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

export const SOURCE_LABELS: Record<string, string> = {
  otsar_hahayal: 'אוצר החייל',
  isracard:      'ישראכרט',
  diners:        'דיינרס/כאל',
  max:           'מקס',
};

export const SOURCE_COLORS: Record<string, string> = {
  otsar_hahayal: 'bg-blue-100 text-blue-700',
  isracard:      'bg-orange-100 text-orange-700',
  diners:        'bg-purple-100 text-purple-700',
  max:           'bg-green-100 text-green-700',
};

export const TYPE_LABELS: Record<string, string> = {
  income:   'הכנסה',
  expense:  'הוצאה',
  savings:  'חיסכון',
  transfer: 'העברה',
};

export const TYPE_COLORS: Record<string, string> = {
  income:   'text-green-600',
  expense:  'text-red-600',
  savings:  'text-blue-600',
  transfer: 'text-gray-600',
};
