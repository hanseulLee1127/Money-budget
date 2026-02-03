import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { allTransactions, recentTransactions, period } = await request.json();

    if (!allTransactions || !recentTransactions) {
      return NextResponse.json(
        { error: 'Missing transaction data' },
        { status: 400 }
      );
    }

    // 데이터 요약 생성
    const allSummary = generateSummary(allTransactions);
    const recentSummary = generateSummary(recentTransactions);

    // AI 프롬프트
    const prompt = `You are a pragmatic financial advisor AI. Analyze the user's spending patterns and provide realistic, conservative advice.

## Overall Data (All time):
${allSummary}

## Recent Data (Last ${period}):
${recentSummary}

Please provide a practical analysis in the following format:

1. **Overview**: Brief, factual summary of their financial situation (2-3 sentences). Focus on numbers and trends, not emotions.

2. **Positive Observations**: 
   - Identify any measurable improvements or stable patterns
   - Be specific with numbers and percentages
   - Keep praise minimal and data-focused

3. **Areas to Monitor**:
   - Identify categories where spending has increased or is high
   - Point out patterns that may need attention
   - Be objective and factual, not dramatic

4. **Practical Recommendations**:
   - Provide 3-4 specific, small, achievable actions
   - Focus on gradual changes (reduce by 10-20%, not 50%)
   - Base suggestions on their actual spending patterns
   - Avoid dramatic lifestyle changes or unrealistic goals

5. **Conservative Savings Target**:
   - Suggest a modest, achievable savings amount (5-10% of spending)
   - Explain one simple way to achieve it

IMPORTANT:
- Be conservative and realistic in all suggestions
- Avoid dramatic language or overly enthusiastic praise
- Focus on small, incremental improvements
- Don't suggest cutting expenses by more than 20% in any category
- Keep tone professional and measured, not motivational

Format your response in clear sections with markdown.`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful financial advisor who provides encouraging, actionable advice.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const analysis = completion.choices[0]?.message?.content || 'Unable to generate analysis.';

    return NextResponse.json({ 
      success: true, 
      analysis,
      summary: {
        all: allSummary,
        recent: recentSummary,
      }
    });

  } catch (error) {
    console.error('Error analyzing spending:', error);
    return NextResponse.json(
      { error: 'Failed to analyze spending' },
      { status: 500 }
    );
  }
}

// 거래 데이터 요약 생성
function generateSummary(transactions: any[]): string {
  if (transactions.length === 0) {
    return 'No transactions available.';
  }

  const totalSpending = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalIncome = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  // 카테고리별 지출
  const categorySpending: { [key: string]: number } = {};
  transactions
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      if (!categorySpending[t.category]) {
        categorySpending[t.category] = 0;
      }
      categorySpending[t.category] += Math.abs(t.amount);
    });

  const topCategories = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, amount]) => `  - ${cat}: $${amount.toFixed(2)}`)
    .join('\n');

  const avgMonthlySpending = totalSpending / (transactions.length > 0 ? Math.max(1, Math.ceil(transactions.length / 30)) : 1);

  return `
- Total Transactions: ${transactions.length}
- Total Income: $${totalIncome.toFixed(2)}
- Total Spending: $${totalSpending.toFixed(2)}
- Net: $${(totalIncome - totalSpending).toFixed(2)}
- Avg Monthly Spending: $${avgMonthlySpending.toFixed(2)}
- Top Spending Categories:
${topCategories}
  `.trim();
}
