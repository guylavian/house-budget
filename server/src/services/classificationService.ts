import { CategoryRule, ICategoryRule } from '../models/CategoryRule';
import { Category } from '../models/Category';

interface ClassificationResult {
  categoryId: string;
  type: 'expense' | 'income' | 'savings' | 'transfer';
  confidence: 'auto' | 'manual';
}

class ClassificationService {
  private rules: ICategoryRule[] = [];
  private fallbackCategoryId: string = '';

  async initialize(): Promise<void> {
    await this.reloadRules();
    const fallback = await Category.findOne({ name: 'אחר' });
    if (fallback) this.fallbackCategoryId = fallback._id.toString();
  }

  async reloadRules(): Promise<void> {
    this.rules = await CategoryRule.find({ isActive: true }).sort({ priority: -1 });
  }

  classify(description: string): ClassificationResult {
    const lower = description.toLowerCase();
    for (const rule of this.rules) {
      const matched = rule.keywords.some(kw => lower.includes(kw.toLowerCase()));
      if (matched) {
        return {
          categoryId: rule.categoryId,
          type: rule.type,
          confidence: 'auto',
        };
      }
    }
    return {
      categoryId: this.fallbackCategoryId,
      type: 'expense',
      confidence: 'manual',
    };
  }
}

export const classificationService = new ClassificationService();
