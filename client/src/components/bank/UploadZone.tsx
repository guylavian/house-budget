import { useRef, useState } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useImportExcelBulk, useRollbackBatch } from '../../hooks/useBank';
import { useCardOwners } from '../../hooks/useConfig';

interface FileImportResult {
  filename: string;
  batchId: string;
  imported: number;
  skipped: number;
  duplicates: number;
  unclassified: number;
  errors: { row: number; message: string }[];
  needsCardStamp?: boolean; // true when Max file with no cardLast4
}

interface BulkImportResult {
  files: FileImportResult[];
  totalImported: number;
  totalUnclassified: number;
}

// Detect Max files that need a card stamp (filename starts with "max" or contains "max_")
function isMaxFile(filename: string): boolean {
  return /max/i.test(filename.replace(/\.(xlsx|xls)$/i, ''));
}

export default function UploadZone() {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [showErrors, setShowErrors] = useState<Record<number, boolean>>({});
  const [stampCard, setStampCard] = useState<Record<number, string>>({});
  const [stampingIdx, setStampingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const importExcelBulk = useImportExcelBulk();
  const rollbackBatch = useRollbackBatch();
  const { data: cardOwners = [] } = useCardOwners();
  const maxOwners = cardOwners.filter(o => o.source === 'max');

  const handleImport = (files: File[]) => {
    const validFiles = files.filter(f => f.name.match(/\.(xlsx|xls)$/i));
    if (validFiles.length === 0) {
      toast.error('יש לבחור קובץ Excel בלבד (.xlsx / .xls)');
      return;
    }
    importExcelBulk.mutate(validFiles, {
      onSuccess: (data: BulkImportResult) => {
        // Mark Max files that imported 0 transactions with no cardLast4 as needing a stamp
        const enriched: BulkImportResult = {
          ...data,
          files: data.files.map(f => ({
            ...f,
            needsCardStamp: isMaxFile(f.filename) && f.errors.length === 0 && f.batchId !== '',
          })),
        };
        setResult(enriched);
        toast.success(`יובאו ${data.totalImported} תנועות בהצלחה`);
      },
      onError: () => {
        toast.error('שגיאה בייבוא הקבצים');
      },
    });
  };

  const handleStampCard = async (fileResult: FileImportResult, idx: number) => {
    const card = stampCard[idx];
    if (!card) { toast.error('יש לבחור כרטיס'); return; }
    setStampingIdx(idx);
    try {
      const res = await axios.patch(`/api/bank/import/${fileResult.batchId}/stamp-card`, { cardLast4: card });
      toast.success(`עודכנו ${res.data.updated} תנועות עם כרטיס ${card}`);
      setResult(prev => prev ? {
        ...prev,
        files: prev.files.map((f, i) => i === idx ? { ...f, needsCardStamp: false } : f),
      } : prev);
    } catch {
      toast.error('שגיאה בהטמעת הכרטיס');
    } finally {
      setStampingIdx(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (files.length > 0) handleImport(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleImport(files);
    e.target.value = '';
  };

  const handleReset = () => {
    setResult(null);
    setShowErrors({});
    setStampCard({});
  };

  if (importExcelBulk.isPending) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">מייבא תנועות...</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={20} className="text-green-600" />
          <h3 className="font-semibold text-gray-900">תוצאות הייבוא</h3>
        </div>

        <div className="space-y-2">
          {result.files.map((fileResult, i) => (
            <div
              key={i}
              className={`rounded p-3 text-sm ${
                fileResult.errors.length > 0
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-green-50 border border-green-200'
              }`}
            >
              <div className="font-medium text-gray-700 mb-1">
                📄 {fileResult.filename}
              </div>
              <div className="flex gap-3 text-xs text-gray-600 flex-wrap">
                <span className="text-green-700">✓ {fileResult.imported} יובאו</span>
                {fileResult.duplicates > 0 &&
                  <span className="text-gray-400">⊘ {fileResult.duplicates} כפולות</span>}
                {fileResult.unclassified > 0 &&
                  <span className="text-yellow-600">⚠ {fileResult.unclassified} לא מסווגות</span>}
                {fileResult.errors.length > 0 && (
                  <button
                    onClick={() => setShowErrors(prev => ({ ...prev, [i]: !prev[i] }))}
                    className="text-red-600 flex items-center gap-1"
                  >
                    ✗ שגיאה: {fileResult.errors[0].message}
                    {showErrors[i] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>
              {showErrors[i] && fileResult.errors.length > 1 && (
                <ul className="mt-2 space-y-0.5">
                  {fileResult.errors.slice(1).map((err, j) => (
                    <li key={j} className="text-xs text-red-700">שורה {err.row}: {err.message}</li>
                  ))}
                </ul>
              )}

              {/* Card stamp fallback for Max files */}
              {fileResult.needsCardStamp && maxOwners.length > 0 && (
                <div className="mt-2 pt-2 border-t border-green-200 flex items-center gap-2 flex-wrap">
                  <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-700">זוהה קובץ מקס — בחר כרטיס:</span>
                  <select
                    className="input text-xs py-0.5 h-7 w-32"
                    value={stampCard[i] ?? ''}
                    onChange={e => setStampCard(prev => ({ ...prev, [i]: e.target.value }))}
                  >
                    <option value="">בחר...</option>
                    {maxOwners.map(o => (
                      <option key={o._id} value={o.cardLast4}>
                        •••• {o.cardLast4} ({o.ownerName})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleStampCard(fileResult, i)}
                    disabled={!stampCard[i] || stampingIdx === i}
                    className="btn-primary text-xs py-0.5 px-2 h-7 disabled:opacity-50"
                  >
                    {stampingIdx === i ? 'מטביע...' : 'הטמע'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {result.files.length > 1 && (
          <div className="text-sm font-medium text-gray-700 pt-1 border-t">
            סה"כ: {result.totalImported} תנועות חדשות
            {result.totalUnclassified > 0 &&
              ` | ${result.totalUnclassified} ממתינות לסיווג`}
          </div>
        )}

        {result.files.some(f => f.batchId) && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleReset} className="btn-primary">
                <Upload size={16} />
                ייבא קבצים נוספים
              </button>
              {result.files.length === 1 && result.files[0].batchId && (
                <button
                  onClick={() => rollbackBatch.mutate(result.files[0].batchId, {
                    onSuccess: () => { toast.success('הייבוא בוטל בהצלחה'); setResult(null); },
                    onError: () => toast.error('שגיאה בביטול הייבוא'),
                  })}
                  disabled={rollbackBatch.isPending}
                  className="btn-danger"
                >
                  <RotateCcw size={16} />
                  {rollbackBatch.isPending ? 'מבטל...' : 'בטל ייבוא'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`card border-2 border-dashed transition-colors cursor-pointer ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className={`p-4 rounded-full ${dragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Upload size={32} className={dragging ? 'text-blue-600' : 'text-gray-400'} />
        </div>
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-1">גרור קבצי Excel לכאן (אפשר כמה בבת אחת)</p>
          <p className="text-gray-400 text-sm">או לחץ לבחירת קבצים</p>
          <p className="text-gray-400 text-xs mt-1">תומך ב: אוצר החייל, ישראכרט, מקס, כאל/דיינרס</p>
        </div>
      </div>
    </div>
  );
}
