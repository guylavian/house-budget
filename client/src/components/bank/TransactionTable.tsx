import { useState } from 'react';
import { Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBankTransactions, useUpdateTransaction, useBulkReclassify, useAiClassifySingle, useAiClassifyBatch, useAiApproveAll } from '../../hooks/useBank';
import { useCategories } from '../../hooks/useConfig';
import type { BankTransaction, Category } from '../../interfaces/bank';
import {
  formatILS, formatDate,
  SOURCE_LABELS, SOURCE_COLORS,
  TYPE_LABELS, TYPE_COLORS,
} from '../../utils/format';

interface Props {
  month: number;
  year: number;
  onShowUncategorized?: () => void;
}

export default function TransactionTable({ month, year }: Props) {
  const [filterSource, setFilterSource] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUnclassified, setFilterUnclassified] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkType, setBulkType] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState('');
  const [pendingType, setPendingType] = useState('');

  const { data: transactionsData, isLoading } = useBankTransactions({
    month, year,
    source: filterSource || undefined,
    type: filterType || undefined,
    unclassified: filterUnclassified || undefined,
  });

  const { data: categoriesRaw } = useCategories();
  const categories: Category[] = categoriesRaw ?? [];

  const updateTransaction = useUpdateTransaction();
  const bulkReclassify = useBulkReclassify();
  const aiClassifySingle = useAiClassifySingle();
  const aiClassifyBatch = useAiClassifyBatch();
  const aiApproveAll = useAiApproveAll();

  const txList: BankTransaction[] = transactionsData?.transactions ?? [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === txList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(txList.map(t => t.id));
    }
  };

  const handleBulkClassify = () => {
    if (!bulkCategoryId) { toast.error('בחר קטגוריה'); return; }
    bulkReclassify.mutate(
      { ids: selectedIds, categoryId: bulkCategoryId, type: bulkType || undefined },
      {
        onSuccess: () => { toast.success('תנועות סווגו בהצלחה'); setSelectedIds([]); },
        onError: () => toast.error('שגיאה בסיווג'),
      }
    );
  };

  const handleAutoClassify = () => {
    bulkReclassify.mutate(
      { reclassifyAll: true, month, year },
      {
        onSuccess: () => { toast.success('סיווג אוטומטי הושלם'); setSelectedIds([]); },
        onError: () => toast.error('שגיאה בסיווג אוטומטי'),
      }
    );
  };

  function handleAiClassify(id: string) {
    aiClassifySingle.mutate(id, {
      onSuccess: (data) => {
        if (data.updated) toast.success('AI סיווג הצעה נוספה');
        else toast('AI לא הצליח לסווג', { icon: '🤖' });
      },
      onError: () => toast.error('שגיאה בסיווג AI'),
    });
  }

  function handleAiBatch() {
    aiClassifyBatch.mutate({ month, year }, {
      onSuccess: (data) => toast.success(`AI סיווג ${data.updated} תנועות`),
      onError: () => toast.error('שגיאה בסיווג AI'),
    });
  }

  function handleAiApproveAll() {
    aiApproveAll.mutate({ month, year }, {
      onSuccess: (data) => toast.success(`אושרו ${data.approved} הצעות AI`),
      onError: () => toast.error('שגיאה באישור'),
    });
  }

  const aiPending = aiClassifyBatch.isPending || aiApproveAll.isPending;
  const hasAiSuggested = txList.some(t => t.confidence === 'ai_suggested');

  function startEdit(tx: BankTransaction) {
    setEditingId(tx.id);
    setPendingCategoryId(tx.categoryId ?? '');
    setPendingType(tx.type);
  }

  function handleCancel() {
    setEditingId(null);
  }

  function handleSave() {
    if (!editingId) return;
    updateTransaction.mutate(
      { id: editingId, categoryId: pendingCategoryId, type: pendingType },
      {
        onSuccess: () => { toast.success('קטגוריה עודכנה'); setEditingId(null); },
        onError: () => toast.error('שגיאה בעדכון קטגוריה'),
      }
    );
  }

  function handleReset(tx: BankTransaction) {
    updateTransaction.mutate(
      { id: tx.id, reset: true },
      {
        onSuccess: () => { toast.success('הוחזר לסיווג אוטומטי'); setEditingId(null); },
        onError: () => toast.error('שגיאה באיפוס סיווג'),
      }
    );
  }

  const getCategoryName = (tx: BankTransaction): string => {
    if (tx.categoryName) return `${tx.categoryIcon ?? ''} ${tx.categoryName}`.trim();
    if (!tx.categoryId) return '❓ לא מסווג';
    const cat = categories.find(c => c._id === tx.categoryId);
    return cat ? `${cat.icon} ${cat.name}` : '❓ לא מסווג';
  };

  const getCategoryColor = (tx: BankTransaction): string => {
    if (tx.categoryColor) return tx.categoryColor;
    if (!tx.categoryId) return '#EF4444';
    const cat = categories.find(c => c._id === tx.categoryId);
    return cat?.color ?? '#EF4444';
  };

  if (isLoading) {
    return (
      <div className="card space-y-3">
        <div className="h-8 skeleton w-48" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 skeleton w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="card">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="label">מקור</label>
            <select className="input" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="">הכל</option>
              <option value="otsar_hahayal">אוצר החייל</option>
              <option value="isracard">ישראכרט</option>
              <option value="diners">דיינרס/כאל</option>
              <option value="max">מקס</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="label">סוג</label>
            <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">הכל</option>
              <option value="income">הכנסה</option>
              <option value="expense">הוצאה</option>
              <option value="savings">חיסכון</option>
              <option value="transfer">העברה ניטרלית</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="unclassified"
              checked={filterUnclassified}
              onChange={e => setFilterUnclassified(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="unclassified" className="text-sm text-gray-700 whitespace-nowrap">ללא סיווג בלבד</label>
          </div>
        </div>
      </div>

      {/* AI action bar */}
      <div className="card bg-purple-50 border-purple-200">
        <div className="flex gap-3 flex-wrap items-center">
          <span className="text-sm font-medium text-purple-700">🤖 סיווג AI</span>
          <button
            onClick={handleAiBatch}
            disabled={aiPending}
            className="btn-secondary text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
          >
            {aiClassifyBatch.isPending ? 'מסווג...' : 'סווג ללא סיווג עם AI'}
          </button>
          {hasAiSuggested && (
            <button
              onClick={handleAiApproveAll}
              disabled={aiPending}
              className="btn-primary text-xs bg-purple-600 hover:bg-purple-700 border-purple-600"
            >
              {aiApproveAll.isPending ? 'מאשר...' : 'אשר הכל'}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex gap-3 flex-wrap items-end">
            <p className="text-sm text-blue-700 font-medium self-center">{selectedIds.length} נבחרו</p>
            <div className="flex-1 min-w-[160px]">
              <label className="label text-blue-700">קטגוריה</label>
              <select className="input" value={bulkCategoryId} onChange={e => setBulkCategoryId(e.target.value)}>
                <option value="">בחר קטגוריה</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="label text-blue-700">סוג</label>
              <select className="input" value={bulkType} onChange={e => setBulkType(e.target.value)}>
                <option value="">ללא שינוי</option>
                <option value="income">הכנסה</option>
                <option value="expense">הוצאה</option>
                <option value="savings">חיסכון</option>
                <option value="transfer">העברה</option>
              </select>
            </div>
            <button
              onClick={handleBulkClassify}
              disabled={bulkReclassify.isPending}
              className="btn-primary"
            >
              {bulkReclassify.isPending ? 'מסווג...' : 'סווג נבחרים'}
            </button>
            <button
              onClick={handleAutoClassify}
              disabled={bulkReclassify.isPending}
              className="btn-secondary"
            >
              סווג אוטומטית
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">מציג {txList.length} תנועות</h3>
          {selectedIds.length === 0 && txList.length > 0 && (
            <button onClick={handleAutoClassify} disabled={bulkReclassify.isPending} className="btn-secondary text-xs">
              סווג אוטומטית
            </button>
          )}
        </div>

        {txList.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-lg mb-1">אין תנועות</p>
            <p className="text-sm">ייבא קובץ מהבנק כדי לראות תנועות</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === txList.length && txList.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="p-3 text-right text-gray-600 font-medium">תאריך</th>
                  <th className="p-3 text-right text-gray-600 font-medium">תיאור</th>
                  <th className="p-3 text-right text-gray-600 font-medium">סכום</th>
                  <th className="p-3 text-right text-gray-600 font-medium">מקור</th>
                  <th className="p-3 text-right text-gray-600 font-medium">בעלים</th>
                  <th className="p-3 text-right text-gray-600 font-medium">קטגוריה</th>
                  <th className="p-3 text-right text-gray-600 font-medium">סוג</th>
                  <th className="p-3 text-right text-gray-600 font-medium">אמון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txList.map(tx => (
                  <tr
                    key={tx.id}
                    className={`transition-colors ${
                      selectedIds.includes(tx.id)
                        ? 'bg-blue-50'
                        : tx.type === 'transfer'
                          ? 'bg-gray-50 opacity-70 hover:opacity-100'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tx.id)}
                        onChange={() => toggleSelect(tx.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="p-3 text-gray-900 max-w-[200px] truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className={`p-3 font-medium whitespace-nowrap ${tx.type === 'transfer' ? 'text-gray-400' : (TYPE_COLORS[tx.type] ?? 'text-gray-600')}`}>
                      {formatILS(Math.abs(tx.chargedAmount))}
                    </td>
                    <td className="p-3">
                      <span className={`badge ${SOURCE_COLORS[tx.source] ?? 'bg-gray-100 text-gray-700'}`}>
                        {SOURCE_LABELS[tx.source] ?? tx.source}
                      </span>
                    </td>
                    <td className="p-3">
                      {tx.ownerName
                        ? <span className="text-sm font-medium text-gray-700">{tx.ownerName}</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>

                    {/* Category cell — inline edit */}
                    <td className="p-3">
                      {tx.type === 'transfer' ? (
                        <span className="badge bg-gray-100 text-gray-500">ניטרלי</span>
                      ) : editingId === tx.id ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <select
                            value={pendingCategoryId}
                            onChange={e => setPendingCategoryId(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                            autoFocus
                          >
                            <option value="">ללא קטגוריה</option>
                            {categories.map(cat => (
                              <option key={cat._id} value={cat._id}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                          <select
                            value={pendingType}
                            onChange={e => setPendingType(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                          >
                            <option value="expense">הוצאה</option>
                            <option value="income">הכנסה</option>
                            <option value="savings">חיסכון</option>
                            <option value="transfer">העברה</option>
                          </select>
                          <button
                            onClick={handleSave}
                            disabled={updateTransaction.isPending}
                            className="text-green-600 hover:text-green-800 font-bold text-sm leading-none"
                            title="שמור"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-gray-400 hover:text-gray-600 font-bold text-sm leading-none"
                            title="בטל"
                          >
                            ✗
                          </button>
                          {tx.confidence === 'manual' && (
                            <button
                              onClick={() => handleReset(tx)}
                              disabled={updateTransaction.isPending}
                              className="text-xs text-gray-400 hover:text-gray-600 underline leading-none"
                            >
                              אוטו
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(tx)}
                          title={tx.confidence === 'manual' ? 'סווג ידנית — לחץ לשינוי' : 'סווג אוטומטית — לחץ לתיקון'}
                          className="group flex items-center gap-1"
                        >
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              tx.confidence === 'manual'
                                ? 'bg-yellow-100 text-yellow-800'
                                : ''
                            }`}
                            style={tx.confidence === 'auto' ? {
                              backgroundColor: getCategoryColor(tx) + '22',
                              color: getCategoryColor(tx),
                            } : undefined}
                          >
                            {getCategoryName(tx)}
                          </span>
                          <Pencil size={10} className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                        </button>
                      )}
                    </td>

                    <td className="p-3">
                      <span className={`text-xs font-medium ${TYPE_COLORS[tx.type] ?? 'text-gray-600'}`}>
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {tx.confidence === 'auto' ? (
                          <span className="badge badge-green">אוטו</span>
                        ) : tx.confidence === 'ai_suggested' ? (
                          <>
                            <span className="badge" style={{ backgroundColor: '#7C3AED22', color: '#7C3AED' }}>🤖 AI</span>
                            <button
                              onClick={() => updateTransaction.mutate(
                                { id: tx.id, categoryId: tx.categoryId ?? undefined, type: tx.type },
                                { onSuccess: () => toast.success('אושר') }
                              )}
                              disabled={updateTransaction.isPending}
                              className="text-xs text-purple-600 hover:text-purple-800 font-medium leading-none"
                              title="אשר הצעת AI"
                            >
                              ✓ אשר
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="badge badge-yellow">ידני</span>
                            <button
                              onClick={() => handleAiClassify(tx.id)}
                              disabled={aiClassifySingle.isPending}
                              className="text-gray-300 hover:text-purple-500 transition-colors leading-none"
                              title="סווג עם AI"
                            >
                              🤖
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
