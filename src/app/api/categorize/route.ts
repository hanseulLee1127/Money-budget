import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCategoryNames } from '@/lib/categories';
import { CategorizedTransaction } from '@/types';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:12',message:'AI categorization started',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text } = body as { text: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No text provided' },
        { status: 400 }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:32',message:'Text received',data:{textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // 카테고리 목록 가져오기
    const categories = getCategoryNames();

    // 현재 날짜 정보 (연도 추론을 위해)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // OpenAI에 거래 추출 + 카테고리 분류 요청
    const prompt = `# Role
You are an expert financial transaction parser and categorizer with deep knowledge of banking terminology and transaction patterns.

# Task
Parse the provided bank/credit card statement and extract ALL transactions into a structured JSON format.

# Input Context
- Available categories: ${categories.join(', ')}
- Reference date: ${currentYear}-${String(currentMonth).padStart(2, '0')}
- Statement text:
"""
${text}
"""

# Output Schema
Return ONLY a valid JSON array with this exact structure:
\`\`\`json
[
  {
    "date": "YYYY-MM-DD",
    "description": "string",
    "amount": number,
    "category": "string"
  }
]
\`\`\`

# Processing Rules

## 1. Date Parsing
- Convert all dates to YYYY-MM-DD format
- **Year inference**: When statement spans year boundary (e.g., Dec-Jan), assign years logically:
  - If reference is 2026-01: "12/15" → 2025-12-15, "01/10" → 2026-01-10
  - Dates should be chronologically sequential

## 2. Amount Sign Convention
| Sign | Transaction Type | Examples |
|------|-----------------|----------|
| **POSITIVE (+)** | Income/Credits | Salary, direct deposits, refunds, Zelle received |
| **NEGATIVE (-)** | Expenses/Debits | Purchases, bills, fees, subscriptions |

## 3. Income Detection Patterns (POSITIVE amounts)
Classify as **Income** when ANY of these patterns match:
- Direct deposits: "EDI Pymnts", "Direct Dep", "Payroll"
- Employer payments: "[Company] Pymt", descriptions ending in "Com", "Inc", "Corp", "LLC" + payment context
- P2P received: "Zelle From [name]", "Venmo From", "PayPal From"
- Refunds: "Refund", "Credit", "Reimbursement"
- Government: "IRS", "Tax Refund", "Stimulus"

**Examples:**
| Description | Amount | Category |
|-------------|--------|----------|
| "Brigham Young Un EDI Pymnts" | +2500.00 | Income |
| "Deseret Book Com Deseret MG Pymt" | +1800.00 | Income |
| "Zelle From John Smith" | +150.00 | Income |

## 4. Expense Classification (NEGATIVE amounts)
Match to most specific category available:
- **Food and Grocery** (use this for groceries, supermarkets, warehouse clubs, restaurants, delivery):
  - Warehouse clubs / bulk retailers: "Costco", "Sam's Club", "BJ's"
  - Supermarkets / grocery: "Walmart", "Kroger", "Safeway", "Albertsons", "Publix", "Whole Foods", "Trader Joe's", "H-E-B", "Giant", "Food Lion", "Aldi", "Lidl", any grocery store
  - Restaurants, "Uber Eats", "DoorDash", "Grubhub" → Food and Grocery
- **Shopping** (general retail, not primarily food): "Amazon", "Target" (when not clearly grocery), department stores, clothing, electronics retailers
- "Shell", "Chevron", "BP" → Transportation
- "Netflix", "Spotify", "Adobe" → Subscription
- Utility companies → Utilities

## 5. EXCLUSION Rules (Do NOT include)
⚠️ CRITICAL: Exclude ALL transactions matching these patterns:
- **Internal transfers**: "Transfer to/from", "Online Xfer", "Online Transfer", account numbers (xxxxxx)
- **Credit card payments**: 
  - "Credit Card Payment", "CC Payment", "Credit Crd Epay"
  - "Thank You Payment", "Payment Thank You", "PAYMENT - THANK YOU"
  - "Payment - Thank You" (any case variation)
  - Description contains both "PAYMENT" AND "THANK YOU" → EXCLUDE
- **Balance movements**: "Balance Transfer", "Account Transfer"

**Important**: If description contains "PAYMENT" + "THANK YOU" in ANY order or format, DO NOT INCLUDE IT.

## 6. Edge Cases
- **Pending transactions**: Include with best available date
- **Foreign currency**: Convert description but use USD amount shown
- **Partial/unclear data**: Include with "Other" category, preserve original description
- **Duplicate entries**: Include only once (some statements show pending + posted)

# Quality Checklist
Before responding, verify:
✓ All visible transactions extracted (none missed)
✓ Excluded transactions are NOT in output
✓ Dates are valid YYYY-MM-DD format
✓ Amounts have correct sign (+/-)
✓ Categories match exactly from provided list
✓ JSON is valid and parseable

# Response Format
Output ONLY the JSON array. No explanations, no markdown code blocks, no additional text.`;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:66',message:'Sending to OpenAI',data:{promptLength:prompt.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial transaction extraction expert. Extract and categorize transactions from bank statements. Return only valid JSON arrays.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '[]';
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:89',message:'OpenAI response received',data:{responseLength:responseText.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    // JSON 파싱
    let transactions: CategorizedTransaction[];
    try {
      // JSON 블록에서 실제 배열만 추출
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        transactions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:103',message:'Transactions parsed',data:{count:transactions.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    } catch (parseError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:109',message:'JSON parse failed',data:{error:parseError instanceof Error?parseError.message:String(parseError),response:responseText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      console.error('Failed to parse OpenAI response:', responseText);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response. The statement format may not be supported.' },
        { status: 500 }
      );
    }

    // 결과 검증
    const validCategories = new Set(categories.map(c => c.toLowerCase()));
    const validatedTransactions = transactions.map((t) => {
      // 카테고리 검증
      if (!validCategories.has(t.category.toLowerCase())) {
        t.category = 'Other';
      }
      
      // rawText 추가 (AI 응답에는 없음)
      return {
        ...t,
        rawText: `${t.date} - ${t.description} - $${Math.abs(t.amount)}`,
      };
    });

    return NextResponse.json({
      success: true,
      data: validatedTransactions,
    });

  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'categorize/route.ts:142',message:'Categorization error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    console.error('Categorization error:', error);
    
    // OpenAI API 에러 처리
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Invalid OpenAI API key' },
          { status: 401 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { success: false, error: 'OpenAI rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to extract and categorize transactions' },
      { status: 500 }
    );
  }
}
