import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';

const MONTH_NAMES: string[] = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function MonthYearPicker() {
  const { selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useStore();

  const goToPrev:()=> void = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNext = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
      <button
        onClick={goToNext}
        className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-600"
        aria-label="חודש הבא"
      >
        <ChevronRight size={16} />
      </button>

      <div className="px-3 py-1 min-w-[130px] text-center">
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </span>
      </div>

      <button
        onClick={goToPrev}
        className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-600"
        aria-label="חודש קודם"
      >
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}
