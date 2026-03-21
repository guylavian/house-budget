import { useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ExportButtonProps } from '../../interfaces/components';

export default function ExportButton({ onExport, label = 'ייצוא Excel' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await onExport();
      toast.success('הקובץ הורד בהצלחה');
    } catch {
      toast.error('שגיאה בייצוא הקובץ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <Download size={16} />
      )}
      <span>{loading ? 'מוריד...' : label}</span>
    </button>
  );
}
