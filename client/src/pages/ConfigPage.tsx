import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Pencil, Trash2, Plus, RefreshCw, X, Stamp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCategoryRules,
  useAddRule,
  useUpdateRule,
  useDeleteRule,
  useReloadRules,
  useAppSettings,
  useUpdateSettings,
  useToggleHouseCategory,
  useCardOwners,
  useCreateCardOwner,
  useDeleteCardOwner,
} from '../hooks/useConfig';
import { useBulkReclassify, useImportBatches, useRollbackBatch, useScraperConfigs, useScrape, useUpdateScraperConfig } from '../hooks/useBank';
import Modal from '../components/shared/Modal';
import EmojiPicker from '../components/shared/EmojiPicker';
import type { Category, CategoryRule, CardOwner } from '../interfaces/bank';

type ActiveTab = 'categories' | 'rules' | 'budget' | 'settings' | 'imports' | 'cards';

const TYPE_LABELS: Record<string, string> = {
  expense: 'הוצאה',
  income: 'הכנסה',
  savings: 'חיסכון',
  transfer: 'העברה',
};

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'categories', label: 'קטגוריות' },
  { key: 'rules', label: 'כללי סיווג' },
  { key: 'budget', label: 'תקציב' },
  { key: 'settings', label: 'הגדרות' },
  { key: 'imports', label: 'היסטוריית ייבוא' },
  { key: 'cards', label: 'כרטיסים ובעלים' },
];

// ─── Categories Tab ──────────────────────────────────────────────────────────

interface CategoryFormValues {
  name: string;
  icon: string;
  color: string;
  type: string;
  budgetAmount: string;
}

const defaultCatForm: CategoryFormValues = {
  name: '',
  icon: '📦',
  color: '#6366f1',
  type: 'expense',
  budgetAmount: '',
};

function CategoriesTab() {
  const { data: categoriesRaw, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const toggleHouseCategory = useToggleHouseCategory();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormValues>(defaultCatForm);

  const categories: Category[] = categoriesRaw ?? [];

  const openAdd = () => {
    setEditingCategory(null);
    setForm(defaultCatForm);
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
      budgetAmount: cat.budgetAmount != null ? String(cat.budgetAmount) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('יש להכניס שם קטגוריה'); return; }
    const payload = {
      name: form.name.trim(),
      icon: form.icon || '📦',
      color: form.color,
      type: form.type,
      ...(form.budgetAmount ? { budgetAmount: Number(form.budgetAmount) } : {}),
    };
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory._id, ...payload }, {
        onSuccess: () => { toast.success('קטגוריה עודכנה'); setShowModal(false); },
        onError: () => toast.error('שגיאה בעדכון קטגוריה'),
      });
    } else {
      createCategory.mutate(payload, {
        onSuccess: () => { toast.success('קטגוריה נוספה'); setShowModal(false); },
        onError: () => toast.error('שגיאה בהוספת קטגוריה'),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteCategory.mutate(id, {
      onSuccess: () => toast.success('קטגוריה נמחקה'),
      onError: () => toast.error('שגיאה במחיקת קטגוריה'),
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} />
          הוסף קטגוריה
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">אין קטגוריות — הוסף קטגוריה ראשונה</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat._id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{cat.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{cat.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-gray-400">{TYPE_LABELS[cat.type] ?? cat.type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cat)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(cat._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="badge text-xs"
                  style={{ backgroundColor: cat.color + '22', color: cat.color }}
                >
                  {TYPE_LABELS[cat.type] ?? cat.type}
                </span>
                {cat.budgetAmount != null && (
                  <span className="text-xs text-gray-500">תקציב: ₪{cat.budgetAmount.toLocaleString()}</span>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                <div
                  onClick={() => toggleHouseCategory.mutate(cat._id, {
                    onSuccess: () => toast.success(cat.isHouseCategory ? 'הוסר מתקציב בית' : 'נוסף לתקציב בית'),
                    onError: () => toast.error('שגיאה בעדכון'),
                  })}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    cat.isHouseCategory ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    cat.isHouseCategory ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </div>
                <span className="text-xs text-gray-500">תקציב בית</span>
              </label>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'עריכת קטגוריה' : 'הוספת קטגוריה'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="label">שם</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="שם הקטגוריה"
            />
          </div>
          <div className="form-group">
            <label className="label">אייקון</label>
            <EmojiPicker
              value={form.icon}
              onChange={icon => setForm(f => ({ ...f, icon }))}
            />
          </div>
          <div className="form-group">
            <label className="label">צבע</label>
            <input
              type="color"
              className="input h-10 p-1 cursor-pointer"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="label">סוג</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="expense">הוצאה</option>
              <option value="income">הכנסה</option>
              <option value="savings">חיסכון</option>
              <option value="transfer">העברה</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">תקציב חודשי (₪) — אופציונלי</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.budgetAmount}
              onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">ביטול</button>
            <button
              type="submit"
              disabled={createCategory.isPending || updateCategory.isPending}
              className="btn-primary"
            >
              {createCategory.isPending || updateCategory.isPending ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────────────────

function RuleForm({
  initialKeywords,
  initialCategory,
  initialType,
  initialPriority,
  initialIsActive,
  categories,
  onSubmit,
  isPending,
  submitLabel,
}: {
  initialKeywords: string[];
  initialCategory: string;
  initialType: string;
  initialPriority: number;
  initialIsActive: boolean;
  categories: Category[];
  onSubmit: (data: { keywords: string[]; categoryId: string; type: string; priority: number; isActive: boolean }) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [kwInput, setKwInput] = useState('');
  const [ruleCategory, setRuleCategory] = useState(initialCategory);
  const [ruleType, setRuleType] = useState(initialType);
  const [rulePriority, setRulePriority] = useState(initialPriority);
  const [isActive, setIsActive] = useState(initialIsActive);

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw]);
    setKwInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.length === 0) { toast.error('הוסף לפחות מילת מפתח אחת'); return; }
    if (!ruleCategory) { toast.error('בחר קטגוריה'); return; }
    onSubmit({ keywords, categoryId: ruleCategory, type: ruleType, priority: rulePriority, isActive });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">מילות מפתח</label>
        <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg min-h-[44px]">
          {keywords.map(kw => (
            <span key={kw} className="badge badge-blue flex items-center gap-1">
              {kw}
              <button
                type="button"
                onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                className="hover:text-blue-900"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            type="text"
            className="outline-none text-sm flex-1 min-w-[120px]"
            placeholder="הקלד מילה + Enter"
            value={kwInput}
            onChange={e => setKwInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
            onBlur={addKeyword}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="form-group">
          <label className="label">קטגוריה</label>
          <select className="input" value={ruleCategory} onChange={e => setRuleCategory(e.target.value)}>
            <option value="">בחר קטגוריה</option>
            {categories.map(c => (
              <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="label">סוג</label>
          <select className="input" value={ruleType} onChange={e => setRuleType(e.target.value)}>
            <option value="expense">הוצאה</option>
            <option value="income">הכנסה</option>
            <option value="savings">חיסכון</option>
            <option value="transfer">העברה</option>
          </select>
        </div>
        <div className="form-group">
          <label className="label">עדיפות</label>
          <input
            type="number"
            min="1"
            max="100"
            className="input"
            value={rulePriority}
            onChange={e => setRulePriority(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ruleIsActive"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <label htmlFor="ruleIsActive" className="text-sm text-gray-700">כלל פעיל</label>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          <Plus size={16} />
          {isPending ? 'שומר...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function RulesTab() {
  const { data: rulesRaw, isLoading: rulesLoading } = useCategoryRules();
  const { data: categoriesRaw } = useCategories();
  const addRule = useAddRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const reloadRules = useReloadRules();
  const bulkReclassify = useBulkReclassify();
  const { selectedMonth, selectedYear } = useStore();

  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllHistoryConfirm, setShowAllHistoryConfirm] = useState(false);

  const rules: CategoryRule[] = rulesRaw ?? [];
  const categories: Category[] = categoriesRaw ?? [];

  const handleDeleteRule = (id: string) => {
    deleteRule.mutate(id, {
      onSuccess: () => toast.success('כלל נמחק'),
      onError: () => toast.error('שגיאה במחיקת כלל'),
    });
  };

  const handleReloadAndReclassify = async () => {
    try {
      await reloadRules.mutateAsync();
      await bulkReclassify.mutateAsync({ reclassifyAll: true, month: selectedMonth, year: selectedYear });
      toast.success('הכללים הוחלו מחדש');
    } catch {
      toast.error('שגיאה בהחלת הכללים');
    }
  };

  const handleAllHistoryReclassify = async () => {
    try {
      const result = await bulkReclassify.mutateAsync({ reclassifyAll: true });
      toast.success(result.updated > 0
        ? `עודכנו ${result.updated} תנועות בכל ההיסטוריה`
        : 'לא נמצאו תנועות לסיווג מחדש'
      );
      setShowAllHistoryConfirm(false);
    } catch {
      toast.error('שגיאה בהחלת הכללים');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleReloadAndReclassify}
          disabled={reloadRules.isPending || bulkReclassify.isPending}
          className="btn-secondary"
        >
          <RefreshCw size={16} />
          {reloadRules.isPending || bulkReclassify.isPending ? 'מחיל...' : 'החל מחדש'}
        </button>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus size={16} />
          הוסף כלל
        </button>
      </div>

      {/* Rules table */}
      <div className="card p-0">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">כללי סיווג ({rules.length})</h3>
        </div>
        {rulesLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-gray-400">אין כללי סיווג — הוסף כלל ראשון</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right text-gray-500 font-medium">מילות מפתח</th>
                  <th className="p-3 text-right text-gray-500 font-medium">קטגוריה</th>
                  <th className="p-3 text-right text-gray-500 font-medium">סוג</th>
                  <th className="p-3 text-right text-gray-500 font-medium">עדיפות</th>
                  <th className="p-3 text-right text-gray-500 font-medium">פעיל</th>
                  <th className="p-3 text-right text-gray-500 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map(rule => (
                  <tr key={rule._id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.keywords.map(kw => (
                          <span key={kw} className="badge badge-blue text-xs">{kw}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {rule.categoryName ?? rule.categoryId}
                    </td>
                    <td className="p-3 text-gray-600">
                      {TYPE_LABELS[rule.type] ?? rule.type}
                    </td>
                    <td className="p-3 text-gray-600">{rule.priority}</td>
                    <td className="p-3">
                      <span className={`badge ${rule.isActive ? 'badge-green' : 'badge-red'}`}>
                        {rule.isActive ? 'כן' : 'לא'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingRule(rule)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule._id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All-history reclassify */}
      <div className="card bg-amber-50 border-amber-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-amber-900">החל כללים על כל ההיסטוריה</p>
            <p className="text-xs text-amber-700 mt-0.5">תנועות שסווגו ידנית לא ישתנו — רק תנועות ללא סיווג יעודכנו.</p>
          </div>
          <button
            onClick={() => setShowAllHistoryConfirm(true)}
            disabled={bulkReclassify.isPending}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            <RefreshCw size={14} className={bulkReclassify.isPending ? 'animate-spin' : ''} />
            {bulkReclassify.isPending ? 'מחיל...' : 'החל על כל ההיסטוריה'}
          </button>
        </div>
      </div>

      {/* All-history confirm modal */}
      <Modal
        isOpen={showAllHistoryConfirm}
        onClose={() => setShowAllHistoryConfirm(false)}
        title="החל כללים על כל ההיסטוריה"
        size="sm"
      >
        <p className="text-gray-600 mb-2">זה יסווג מחדש את כל התנועות הלא מסווגות בכל החודשים.</p>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
          תנועות שסווגו ידנית לא ישתנו.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setShowAllHistoryConfirm(false)} className="btn-secondary">ביטול</button>
          <button
            onClick={handleAllHistoryReclassify}
            disabled={bulkReclassify.isPending}
            className="btn-primary"
          >
            {bulkReclassify.isPending ? 'מחיל...' : 'המשך'}
          </button>
        </div>
      </Modal>

      {/* Add modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="הוסף כלל חדש"
      >
        <RuleForm
          key="add"
          initialKeywords={[]}
          initialCategory=""
          initialType="expense"
          initialPriority={50}
          initialIsActive={true}
          categories={categories}
          onSubmit={(data) => addRule.mutate(data, {
            onSuccess: () => { toast.success('כלל נוסף'); setShowAddModal(false); },
            onError: () => toast.error('שגיאה בהוספת כלל'),
          })}
          isPending={addRule.isPending}
          submitLabel="הוסף כלל"
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={editingRule !== null}
        onClose={() => setEditingRule(null)}
        title="עריכת כלל סיווג"
      >
        {editingRule && (
          <RuleForm
            key={editingRule._id}
            initialKeywords={editingRule.keywords}
            initialCategory={editingRule.categoryId}
            initialType={editingRule.type}
            initialPriority={editingRule.priority}
            initialIsActive={editingRule.isActive}
            categories={categories}
            onSubmit={(data) => updateRule.mutate(
              { id: editingRule._id, ...data },
              {
                onSuccess: () => { toast.success('כלל עודכן'); setEditingRule(null); },
                onError: () => toast.error('שגיאה בעדכון כלל'),
              }
            )}
            isPending={updateRule.isPending}
            submitLabel="שמור שינויים"
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Budget Tab ───────────────────────────────────────────────────────────────

function BudgetTab() {
  const { data: categoriesRaw, isLoading } = useCategories();
  const updateCategory = useUpdateCategory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const categories: Category[] = (categoriesRaw ?? []).filter((c: Category) => c.type === 'expense');

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (cat: Category) => {
    setEditingId(cat._id);
    setEditValue(cat.budgetAmount != null ? String(cat.budgetAmount) : '');
  };

  const saveEdit = (cat: Category) => {
    const val = editValue.trim();
    const amount = val ? Number(val) : undefined;
    updateCategory.mutate({ id: cat._id, budgetAmount: amount }, {
      onSuccess: () => toast.success('תקציב עודכן'),
      onError: () => toast.error('שגיאה בעדכון תקציב'),
    });
    setEditingId(null);
  };

  if (isLoading) {
    return <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 skeleton" />)}</div>;
  }

  if (categories.length === 0) {
    return <div className="card text-center py-10 text-gray-400">אין קטגוריות הוצאה — הוסף קטגוריה מסוג הוצאה תחילה</div>;
  }

  return (
    <div className="card p-0">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">תקציב חודשי לפי קטגוריה</h3>
        <p className="text-xs text-gray-400 mt-0.5">לחץ על הסכום לעריכה</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-right text-gray-500 font-medium">קטגוריה</th>
            <th className="p-3 text-right text-gray-500 font-medium">תקציב חודשי (₪)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {categories.map(cat => (
            <tr key={cat._id} className="hover:bg-gray-50">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-gray-800">{cat.name}</span>
                </div>
              </td>
              <td className="p-3">
                {editingId === cat._id ? (
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    className="input w-32"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(cat)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(cat);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => startEdit(cat)}
                    className="text-left font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {cat.budgetAmount != null ? `₪${cat.budgetAmount.toLocaleString()}` : (
                      <span className="text-gray-400 text-sm italic">לא הוגדר — לחץ לעריכה</span>
                    )}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Scraper Section ──────────────────────────────────────────────────────────

interface ScraperConfigData {
  source:              string;
  label:               string;
  credentialFields:    string[];
  isEnabled:           boolean;
  autoScrapeEnabled:   boolean;
  lastScrapedAt?:      string;
  lastScrapedStatus?:  'success' | 'error';
  lastScrapedMessage?: string;
}

const FIELD_LABELS: Record<string, string> = {
  username:    'שם משתמש',
  password:    'סיסמה',
  id:          'תעודת זהות',
  card6Digits: '6 ספרות אחרונות של כרטיס',
};

function ScraperModal({ config, onClose }: { config: ScraperConfigData; onClose: () => void }) {
  const [creds, setCreds]           = useState<Record<string, string>>({});
  const [monthsBack, setMonthsBack] = useState(1);
  const scrape = useScrape();

  const handleScrape = () => {
    scrape.mutate({ source: config.source, credentials: creds, monthsBack });
  };

  return (
    <Modal isOpen onClose={onClose} title={`סריקת ${config.label}`} size="sm">
      <div className="space-y-4">
        {config.credentialFields.map(field => (
          <div key={field} className="form-group">
            <label className="label">{FIELD_LABELS[field] ?? field}</label>
            <input
              type={field === 'password' ? 'password' : 'text'}
              className="input"
              value={creds[field] ?? ''}
              onChange={e => setCreds(prev => ({ ...prev, [field]: e.target.value }))}
              autoComplete="off"
              dir="ltr"
            />
          </div>
        ))}

        <div className="form-group">
          <label className="label">כמה חודשים אחורה?</label>
          <select className="input" value={monthsBack} onChange={e => setMonthsBack(Number(e.target.value))}>
            <option value={1}>חודש אחרון</option>
            <option value={2}>2 חודשים אחרונים</option>
            <option value={3}>3 חודשים אחרונים</option>
          </select>
        </div>

        <p className="text-xs text-gray-400">
          🔒 הפרטים לא נשמרים — משמשים לחיבור חד-פעמי בלבד
        </p>

        {scrape.isPending && (
          <p className="text-sm text-blue-600 animate-pulse">
            מתחבר לאתר {config.label}... (עלול לקחת 30–60 שניות)
          </p>
        )}

        {scrape.isSuccess && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✅ יובאו {(scrape.data as { imported: number }).imported} תנועות חדשות
            {(scrape.data as { unclassified: number }).unclassified > 0 &&
              ` | ${(scrape.data as { unclassified: number }).unclassified} ממתינות לסיווג`}
          </div>
        )}

        {scrape.isError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(scrape.error as any)?.response?.data?.error ?? 'שגיאה בסריקה'}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary">סגור</button>
          <button
            onClick={handleScrape}
            disabled={scrape.isPending}
            className="btn-primary"
          >
            {scrape.isPending ? 'סורק...' : 'סרוק'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ScraperSection() {
  const { data: configs, isLoading } = useScraperConfigs();
  const updateConfig = useUpdateScraperConfig();
  const [activeConfig, setActiveConfig] = useState<ScraperConfigData | null>(null);

  const list: ScraperConfigData[] = configs ?? [];

  return (
    <div>
      <h3 className="font-semibold text-gray-800 mb-4">סריקה אוטומטית מהבנק</h3>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(config => (
            <div key={config.source} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{config.label}</span>
                    {config.isEnabled ? (
                      <span className="badge badge-green text-xs">פעיל</span>
                    ) : (
                      <span className="badge badge-red text-xs">מושבת</span>
                    )}
                    {config.lastScrapedStatus === 'error' && (
                      <span className="badge badge-red text-xs">שגיאה אחרונה</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {config.lastScrapedAt
                      ? `נסרק לאחרונה: ${new Date(config.lastScrapedAt).toLocaleDateString('he-IL')}${config.lastScrapedMessage ? ` — ${config.lastScrapedMessage}` : ''}`
                      : 'לא נסרק עדיין'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Enable/disable toggle */}
                  <div
                    onClick={() => updateConfig.mutate({ source: config.source, isEnabled: !config.isEnabled }, {
                      onError: () => toast.error('שגיאה בעדכון'),
                    })}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                      config.isEnabled ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>

                  <button
                    onClick={() => setActiveConfig(config)}
                    disabled={!config.isEnabled}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    סרוק עכשיו
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeConfig && (
        <ScraperModal config={activeConfig} onClose={() => setActiveConfig(null)} />
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState({ largeExpenseThreshold: '', minSavingsRate: '', incomeDrop: '' });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setForm({
        largeExpenseThreshold: settings.largeExpenseThreshold != null ? String(settings.largeExpenseThreshold) : '',
        minSavingsRate: settings.minSavingsRate != null ? String(settings.minSavingsRate) : '',
        incomeDrop: settings.incomeDrop != null ? String(settings.incomeDrop) : '',
      });
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(
      {
        largeExpenseThreshold: form.largeExpenseThreshold ? Number(form.largeExpenseThreshold) : undefined,
        minSavingsRate: form.minSavingsRate ? Number(form.minSavingsRate) : undefined,
        incomeDrop: form.incomeDrop ? Number(form.incomeDrop) : undefined,
      },
      {
        onSuccess: () => toast.success('הגדרות נשמרו'),
        onError: () => toast.error('שגיאה בשמירת הגדרות'),
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton" />)}</div>;
  }

  return (
    <div className="space-y-8">
    <div className="card max-w-lg">
      <h3 className="font-semibold text-gray-800 mb-5">הגדרות מערכת</h3>
      <form onSubmit={handleSave} className="space-y-5">
        <div className="form-group">
          <label className="label">סף הוצאה גדולה (₪)</label>
          <input
            type="number"
            min="0"
            className="input"
            value={form.largeExpenseThreshold}
            onChange={e => setForm(f => ({ ...f, largeExpenseThreshold: e.target.value }))}
            placeholder="לדוג׳: 2000"
          />
          <p className="text-xs text-gray-400 mt-1">הוצאה מעל סכום זה תסומן כ"הוצאה גדולה"</p>
        </div>
        <div className="form-group">
          <label className="label">שיעור חיסכון מינימלי (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            className="input"
            value={form.minSavingsRate}
            onChange={e => setForm(f => ({ ...f, minSavingsRate: e.target.value }))}
            placeholder="לדוג׳: 15"
          />
          <p className="text-xs text-gray-400 mt-1">התראה אם שיעור החיסכון ירד מתחת לסף זה</p>
        </div>
        <div className="form-group">
          <label className="label">סף ירידה בהכנסה (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            className="input"
            value={form.incomeDrop}
            onChange={e => setForm(f => ({ ...f, incomeDrop: e.target.value }))}
            placeholder="לדוג׳: 10"
          />
          <p className="text-xs text-gray-400 mt-1">התראה אם ההכנסה ירדה ביותר מאחוז זה לעומת החודש הקודם</p>
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={updateSettings.isPending} className="btn-primary">
            {updateSettings.isPending ? 'שומר...' : 'שמור הגדרות'}
          </button>
        </div>
      </form>
    </div>

    <ScraperSection />
    </div>
  );
}

// ─── Import History Tab ───────────────────────────────────────────────────────

interface ImportBatch {
  id: string;
  source: string;
  month: number;
  year: number;
  fileType: string;
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: number;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  otsar_hahayal: 'אוצר החייל',
  isracard: 'ישראכרט',
  diners: 'דיינרס/כאל',
};

function ImportHistoryTab() {
  const { data: batches, isLoading } = useImportBatches();
  const rollback = useRollbackBatch();

  if (isLoading) {
    return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 skeleton" />)}</div>;
  }

  const batchList: ImportBatch[] = batches ?? [];

  if (batchList.length === 0) {
    return <div className="card text-center py-10 text-gray-400">אין ייבואים — ייבא קובץ מהבנק בכדי לראות היסטוריה</div>;
  }

  return (
    <div className="card p-0">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">היסטוריית ייבוא ({batchList.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right text-gray-500 font-medium">תאריך</th>
              <th className="p-3 text-right text-gray-500 font-medium">מקור</th>
              <th className="p-3 text-right text-gray-500 font-medium">תנועות</th>
              <th className="p-3 text-right text-gray-500 font-medium">שגיאות</th>
              <th className="p-3 text-right text-gray-500 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batchList.map(batch => (
              <tr key={batch.id} className="hover:bg-gray-50">
                <td className="p-3 text-gray-600 whitespace-nowrap">
                  {new Date(batch.createdAt).toLocaleDateString('he-IL')}
                </td>
                <td className="p-3 text-gray-700">
                  {SOURCE_LABELS[batch.source] ?? batch.source}
                </td>
                <td className="p-3 text-gray-700">{batch.rowsImported}</td>
                <td className="p-3 text-gray-700">{batch.rowsSkipped}</td>
                <td className="p-3">
                  <button
                    onClick={() => {
                      if (confirm('לבטל ייבוא זה? כל התנועות שייבאת יימחקו.')) {
                        rollback.mutate(batch.id, {
                          onSuccess: () => toast.success('ייבוא בוטל'),
                          onError: () => toast.error('שגיאה בביטול הייבוא'),
                        });
                      }
                    }}
                    disabled={rollback.isPending}
                    className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                  >
                    בטל
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cards Tab ────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'isracard',      label: 'ישראכרט' },
  { value: 'max',           label: 'מקס' },
  { value: 'diners',        label: 'כאל / דיינרס' },
  { value: 'otsar_hahayal', label: 'אוצר החייל' },
];

const SOURCE_LABELS_MAP: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map(o => [o.value, o.label])
);

function CardsTab() {
  const { data: owners = [], isLoading } = useCardOwners();
  const createOwner = useCreateCardOwner();
  const deleteOwner = useDeleteCardOwner();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ source: 'isracard', cardLast4: '', ownerName: '' });
  const [stampingId, setStampingId] = useState<string | null>(null);

  const handleStamp = async (owner: CardOwner) => {
    setStampingId(owner._id);
    try {
      const result = await axios.post('/api/config/card-owners/backfill', {
        source:    owner.source,
        cardLast4: owner.cardLast4,
      });
      toast.success(`עודכנו ${result.data.totalUpdated} תנועות עם כרטיס ${owner.cardLast4}`);
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    } catch {
      toast.error('שגיאה בהטמעת הכרטיס');
    } finally {
      setStampingId(null);
    }
  };

  const handleSave = () => {
    if (!form.cardLast4.trim() || !form.ownerName.trim()) return;
    createOwner.mutate(form, {
      onSuccess: () => {
        setForm({ source: 'isracard', cardLast4: '', ownerName: '' });
        setShowForm(false);
        toast.success('כרטיס נוסף');
      },
      onError: () => toast.error('שגיאה בהוספת כרטיס'),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">שיוך כרטיסי אשראי לבעלים</h3>
            <p className="text-xs text-gray-400 mt-0.5">הגדר מי הבעלים של כל כרטיס, כדי לראות חתך הוצאות לפי אדם</p>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">
            <Plus size={14} />
            הוסף שיוך
          </button>
        </div>

        {showForm && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex gap-3 flex-wrap items-end">
              <div className="form-group mb-0">
                <label className="label">מקור</label>
                <select className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  <option value="">בחר מקור...</option>
                  {SOURCE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="label">4 ספרות אחרונות</label>
                <input
                  type="text"
                  className="input w-28"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="3205"
                  dir="ltr"
                  value={form.cardLast4}
                  onChange={e => setForm(f => ({ ...f, cardLast4: e.target.value.replace(/\D/g, '') }))}
                />
              </div>
              <div className="form-group mb-0">
                <label className="label">שם בעלים</label>
                <input
                  type="text"
                  className="input"
                  placeholder="גיא"
                  value={form.ownerName}
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                />
              </div>
              <button onClick={handleSave} disabled={createOwner.isPending} className="btn-primary">שמור</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">ביטול</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
        ) : owners.length === 0 ? (
          <div className="p-10 text-center text-gray-400">אין שיוכים — הוסף כרטיס ראשון</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-right text-gray-500 font-medium">מקור</th>
                <th className="p-3 text-right text-gray-500 font-medium">כרטיס</th>
                <th className="p-3 text-right text-gray-500 font-medium">בעלים</th>
                <th className="p-3 text-right text-gray-500 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {owners.map(owner => (
                <tr key={owner._id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-700">{SOURCE_LABELS_MAP[owner.source] ?? owner.source}</td>
                  <td className="p-3 font-mono text-gray-800">•••• {owner.cardLast4}</td>
                  <td className="p-3 font-medium text-gray-900">{owner.ownerName}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStamp(owner)}
                        disabled={stampingId === owner._id}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                        title="מטביע את מספר הכרטיס על תנועות ישנות שיובאו לפני הגדרת השיוך"
                      >
                        <Stamp size={14} className={stampingId === owner._id ? 'animate-pulse' : ''} />
                      </button>
                      <button
                        onClick={() => deleteOwner.mutate(owner._id, {
                          onSuccess: () => toast.success('הוסר'),
                          onError: () => toast.error('שגיאה'),
                        })}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('categories');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">הגדרות</h2>
        <p className="text-sm text-gray-500 mt-0.5">ניהול קטגוריות, כללי סיווג ותקציב</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'budget' && <BudgetTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'imports' && <ImportHistoryTab />}
      {activeTab === 'cards' && <CardsTab />}
    </div>
  );
}
