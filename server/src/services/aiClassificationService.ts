import { Category } from '../models/Category';

interface AiSuggestion {
  categoryId: string;
  categoryName: string;
  type: 'expense' | 'income' | 'savings' | 'transfer';
}

const VALID_TYPES = ['expense', 'income', 'savings', 'transfer'] as const;

class AiClassificationService {
  private get baseUrl() {
    return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  private get model() {
    return process.env.OLLAMA_MODEL ?? 'llama3.3:70b';
  }

  get isEnabled() {
    return process.env.AI_CLASSIFICATION_ENABLED !== 'false';
  }

  async classify(description: string, amount: number): Promise<AiSuggestion | null> {
    if (!this.isEnabled) return null;
    try {
      const categories = await Category.find({}, { name: 1, icon: 1 });
      const categoryList = categories.map(c => `- ${c.name}`).join('\n');

      const prompt = `אתה מסווג הוצאות ביתיות בישראל. סווג את תנועת הבנק הבאה לקטגוריה המתאימה.

תיאור: "${description}"
סכום: ${Math.abs(amount)} ₪

קטגוריות זמינות:
${categoryList}

החזר JSON בלבד (ללא טקסט נוסף):
{"category": "שם קטגוריה מהרשימה", "type": "expense|income|savings|transfer"}

הסבר:
- expense = הוצאה רגילה (מזון, בילויים, ביגוד וכו')
- income = הכנסה (משכורת, העברה נכנסת)
- savings = חיסכון (הפקדה לחיסכון, קרן)
- transfer = העברה ניטרלית בין חשבונות`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.model, prompt, stream: false }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json() as { response?: string };
      const text: string = data.response ?? '';
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) return null;

      const parsed = JSON.parse(match[0]) as { category?: string; type?: string };
      if (!parsed.category) return null;

      const category = categories.find(c => c.name === parsed.category);
      if (!category) return null;

      const type = VALID_TYPES.includes(parsed.type as typeof VALID_TYPES[number])
        ? (parsed.type as AiSuggestion['type'])
        : 'expense';

      return {
        categoryId: category._id.toString(),
        categoryName: category.name,
        type,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConnRefused = msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed');
      const isAborted = err instanceof Error && err.name === 'AbortError';
      if (!isConnRefused && !isAborted) {
        console.warn('[AI] classify error:', msg);
      }
      return null;
    }
  }

  async classifyBatch(
    txns: { id: string; description: string; chargedAmount: number }[]
  ): Promise<{ id: string; suggestion: AiSuggestion | null }[]> {
    const results: { id: string; suggestion: AiSuggestion | null }[] = [];
    for (const txn of txns) {
      const suggestion = await this.classify(txn.description, txn.chargedAmount);
      results.push({ id: txn.id, suggestion });
      await new Promise(r => setTimeout(r, 200));
    }
    return results;
  }
}

export const aiClassificationService = new AiClassificationService();
