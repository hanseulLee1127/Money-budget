import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getCategoryNames } from '@/lib/categories';
import { CategorizedTransaction } from '@/types';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Next.js API route 타임아웃 연장 (기본 10초 → 5분)
export const maxDuration = 300;

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
You are an expert financial transaction parser and categorizer with deep knowledge of banking terminology, transaction patterns, and CSV/PDF statement formats.

# Task
Parse the provided bank/credit card statement (PDF text or CSV) and extract ALL real transactions into a structured JSON format.

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

## 1. CSV Format Detection
⚠️ CRITICAL: If the input is CSV data, pay close attention to the column headers to determine which column is the amount and how debits vs credits are represented.

Common CSV patterns:
- **Separate Debit/Credit columns**: "Date,Description,Debit,Credit" → Debit column = expenses (make NEGATIVE), Credit column = income (make POSITIVE)
- **Single Amount column with type**: "Date,Description,Amount,Type" → if Type="debit" make negative, if Type="credit" make positive
- **Single Amount column (all positive)**: Most bank CSVs show ALL amounts as positive numbers. In this case, almost every transaction is a PURCHASE/EXPENSE and should be NEGATIVE. Only classify as positive income if description clearly matches income patterns (payroll, direct deposit, refund, Zelle received, etc.)
- **Single Amount column with sign**: If amounts already have negative signs, respect them
- **"Balance" column**: IGNORE any balance column — it's the running account balance, NOT a transaction amount

**DEFAULT ASSUMPTION**: If the CSV has a single amount column with all positive numbers, treat the VAST MAJORITY as expenses (NEGATIVE amounts). Only mark as positive if the description clearly indicates income (salary, direct deposit, refund, Zelle From, etc.). Regular purchases at stores, restaurants, gas stations, subscriptions — ALL of these should be NEGATIVE.

## 2. Date Parsing
- Convert all dates to YYYY-MM-DD format
- **Year inference**: When statement spans year boundary (e.g., Dec-Jan), assign years logically:
  - If reference is 2026-01: "12/15" → 2025-12-15, "01/10" → 2026-01-10
  - Dates should be chronologically sequential

## 3. Amount Sign Convention
| Sign | Transaction Type | Examples |
|------|-----------------|----------|
| **NEGATIVE (-)** | Expenses/Debits/Purchases | Store purchases, bills, fees, subscriptions, restaurants, gas |
| **POSITIVE (+)** | Income/Credits ONLY | Salary, direct deposits, refunds, Zelle received |

⚠️ **IMPORTANT**: The vast majority of transactions on a bank or credit card statement are EXPENSES. When in doubt, make the amount NEGATIVE. Only use positive for clear income/credit patterns.

## 4. Income Detection Patterns (POSITIVE amounts)
Classify as **Income** (positive) ONLY when description clearly matches:
- Direct deposits: "EDI Pymnts", "Direct Dep", "Payroll", "ACH Credit"
- Employer payments: "[Company] Pymt" with payment context
- P2P received: "Zelle From [name]", "Venmo From", "PayPal From"
- Refunds: "Refund", "Return Credit", "Reimbursement"
- Government: "IRS", "Tax Refund", "Stimulus"

**Everything else is an EXPENSE (negative amount).**

## 5. Expense Classification (NEGATIVE amounts)
Always choose the MOST SPECIFIC category:

### Food & Dining
- **Groceries**: Supermarkets, warehouse clubs (Costco, Sam's Club, BJ's), grocery stores (Walmart Grocery, Kroger, Safeway, Albertsons, Publix, Whole Foods, Trader Joe's, H-E-B, Giant, Food Lion, Aldi, Lidl)
- **Restaurants**: Sit-down restaurants, fast food (McDonald's, Chick-fil-A, Wendy's, Chipotle), food delivery (Uber Eats, DoorDash, Grubhub, Postmates)
- **Coffee Shops**: Starbucks, Dunkin', Dutch Bros, local coffee shops, tea houses

### Housing
- **Rent & Mortgage**: Rent payments, mortgage payments, HOA fees
- **Utilities**: Electricity, water, gas (utility), sewage, trash/waste
- **Internet & Phone**: Internet providers (Comcast, Xfinity, AT&T, Verizon, T-Mobile), cell phone plans
- **Home Maintenance**: Home repairs, cleaning services, lawn care, home improvement stores (Home Depot, Lowe's), furniture

### Transportation
- **Gas & Fuel**: Gas stations (Shell, Chevron, BP, ExxonMobil, Costco Gas)
- **Public Transit**: Bus, subway, train, metro cards
- **Car Payment**: Auto loans, car lease payments
- **Parking & Tolls**: Parking meters, parking garages, toll roads, EZ-Pass

### Shopping
- **Shopping**: General retail (Amazon, Target, Walmart non-grocery), department stores
- **Clothing**: Clothing stores (Nike, H&M, Zara, Old Navy, TJ Maxx, Ross)
- **Electronics**: Tech/gadget stores (Apple, Best Buy, Newegg)

### Health
- **Medical**: Doctor visits, hospital, dental, vision, lab tests
- **Pharmacy**: CVS, Walgreens, Rite Aid, prescription medications
- **Gym & Fitness**: Gym memberships (Planet Fitness, LA Fitness, CrossFit), fitness classes, yoga

### Insurance
- **Insurance**: Health insurance, life insurance, home insurance, car insurance, renters insurance

### Entertainment & Lifestyle
- **Entertainment**: Movies, concerts, events, amusement parks, sports tickets, gaming
- **Subscriptions**: Streaming (Netflix, Spotify, Hulu, Disney+, HBO), software (Adobe, Microsoft), app subscriptions
- **Education**: Tuition, textbooks, online courses (Udemy, Coursera), school supplies
- **Personal Care**: Haircuts, salons, spas, beauty products, cosmetics
- **Pets**: Pet food, veterinary, pet supplies, grooming
- **Gifts & Donations**: Gifts, charity donations, religious tithes
- **Travel**: Flights, hotels, Airbnb, rental cars, luggage, travel agencies

### Other
- **Other**: Anything that doesn't clearly fit the above categories

## 6. EXCLUSION Rules (Do NOT include)
⚠️ CRITICAL: Exclude ALL transactions matching these patterns. Do NOT output them:
- **Internal transfers**: "Transfer to/from", "Online Xfer", "Online Transfer", account numbers (xxxxxx), "Xfer", "ACH Transfer"
- **Credit card payments**:
  - "Credit Card Payment", "CC Payment", "Credit Crd Epay"
  - ANY description containing "THANK YOU" — this is a credit card payment, NOT a real transaction
  - ANY description containing "PAYMENT" when it refers to paying a credit card bill
  - "Payment Thank You", "PAYMENT - THANK YOU", "Thank You - Payment", "Payment - Thank"
  - "Autopay", "Auto Pay" (when it's paying the credit card itself)
- **Balance movements**: "Balance Transfer", "Account Transfer"
- **Interest charges / fees that are internal**: "Interest Charge", "Late Fee" (optional — include only if the user would consider them relevant expenses)

## 7. Edge Cases
- **Pending transactions**: Include with best available date
- **Foreign currency**: Convert description but use USD amount shown
- **Partial/unclear data**: Include with "Other" category, preserve original description
- **Duplicate entries**: Include only once (some statements show pending + posted)

# Quality Checklist
Before responding, verify:
✓ All real purchase/expense transactions extracted (none missed)
✓ Excluded transactions (payments, transfers, "thank you") are NOT in output
✓ Dates are valid YYYY-MM-DD format
✓ Store purchases, restaurants, bills, subscriptions → NEGATIVE amounts
✓ Only clear income/deposits/refunds → POSITIVE amounts
✓ Categories match EXACTLY from the provided list (case-sensitive)
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
      max_tokens: 8000, // 100개 chunk에 최적화
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

    // 결과 검증 + 후처리
    const validCategories = new Set(categories.map(c => c.toLowerCase()));

    // 제외 패턴 (서버 사이드 안전장치)
    const exclusionPatterns = [
      /thank\s*you/i,
      /payment\s*-?\s*thank/i,
      /credit\s*card\s*payment/i,
      /cc\s*payment/i,
      /online\s*xfer/i,
      /online\s*transfer/i,
      /balance\s*transfer/i,
      /account\s*transfer/i,
      /autopay/i,
      /auto\s*pay/i,
    ];

    // Income 패턴 (positive로 유지해야 하는 것들)
    const incomePatterns = [
      /direct\s*dep/i,
      /payroll/i,
      /edi\s*pymnts/i,
      /ach\s*credit/i,
      /zelle\s*from/i,
      /venmo\s*from/i,
      /paypal\s*from/i,
      /refund/i,
      /reimbursement/i,
      /return\s*credit/i,
      /tax\s*refund/i,
      /stimulus/i,
    ];

    const validatedTransactions = transactions
      // 1. 제외 패턴 필터
      .filter((t) => {
        const desc = (t.description || '').trim();
        return !exclusionPatterns.some((p) => p.test(desc));
      })
      // 2. 검증 + 부호 보정
      .map((t) => {
        // 카테고리 검증
        if (!validCategories.has(t.category.toLowerCase())) {
          t.category = 'Other';
        }

        // 부호 보정: Income 카테고리가 아니고 income 패턴에도 안 맞으면 expense → 반드시 음수
        const desc = (t.description || '').trim();
        const isIncomeCategory = t.category.toLowerCase() === 'income';
        const matchesIncomePattern = incomePatterns.some((p) => p.test(desc));

        if (!isIncomeCategory && !matchesIncomePattern && t.amount > 0) {
          // AI가 양수로 줬지만 income이 아닌 경우 → 음수로 변환
          t.amount = -Math.abs(t.amount);
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
