import type { Column, DataTableProps } from '../../interfaces/components';
import type { ReactNode } from 'react';

export type { Column };

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function DataTable<T extends object>({
  data,
  columns,
  loading = false,
  emptyMessage = 'אין נתונים להצגה',
  keyExtractor,
}: DataTableProps<T>) {
  const getCellValue = (row: T, col: Column<T>): ReactNode => {
    if (col.render) return col.render(row);
    const value = row[col.key as keyof T];
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  const getKey = (row: T, index: number): string | number => {
    if (keyExtractor) return keyExtractor(row);
    if ('id' in row) return (row as { id: string | number }).id;
    return index;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} columns={columns.length} />
              ))
            : data.length === 0
            ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )
            : data.map((row, index) => (
                <tr
                  key={getKey(row, index)}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                    >
                      {getCellValue(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
