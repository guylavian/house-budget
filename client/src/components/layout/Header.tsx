import { useState } from 'react';
import { Menu, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store/useStore';
import MonthYearPicker from '../shared/MonthYearPicker';
import { exportApi } from '../../services/api';

export default function Header() {
  const { setSidebarOpen } = useStore();
  const [exporting, setExporting] = useState(false);

  const handleExportFullReport = async () => {
    setExporting(true);
    try {
      await exportApi.fullReport();
      toast.success('הדוח הורד בהצלחה');
    } catch {
      toast.error('שגיאה בייצוא הדוח');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="פתח תפריט"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-bold text-gray-900 hidden sm:block">
          מנהל תקציב משפחתי
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <MonthYearPicker />
        <button
          onClick={handleExportFullReport}
          disabled={exporting}
          className="btn-secondary hidden sm:flex disabled:opacity-60"
          title="ייצוא דוח מלא"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileDown size={16} />
          )}
          <span className="hidden md:inline">דוח מלא</span>
        </button>
      </div>
    </header>
  );
}
