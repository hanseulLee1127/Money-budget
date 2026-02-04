import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';

// PII patterns: removed before any text is sent to AI (parse-pdf → categorize).
// AI never receives account numbers, routing numbers, SSN, card numbers, phone, or email.
const PII_PATTERNS = {
  // Full credit card number (16 digits, optional spaces/dashes)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // Account number: "account"/"acct" followed by 8–17 digits
  fullAccountNumber: /\b(?:account|acct)[\s#:]*\d{8,17}\b/gi,
  // Account "ending in" / "last 4" digits
  accountEndingIn: /\b(?:account|acct)[\s#:]*(?:ending in|last four|last 4)[\s#:]*\d{4}\b/gi,
  // US routing number (9 digits), only when labeled (routing/ABA/RTN)
  routingNumber: /\b(?:routing|aba|rtn)[\s#:]*\d{9}\b/gi,
  // SSN format XXX-XX-XXXX
  ssn: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
  // US phone: (xxx) xxx-xxxx, xxx-xxx-xxxx (requires separator to avoid redacting ref numbers)
  phone: /\b\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
  // Email
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
};

function removeSensitivePII(text: string): string {
  let cleanedText = text;

  cleanedText = cleanedText.replace(PII_PATTERNS.ssn, '[SSN-REDACTED]');
  cleanedText = cleanedText.replace(PII_PATTERNS.creditCard, '[CARD-REDACTED]');
  cleanedText = cleanedText.replace(PII_PATTERNS.fullAccountNumber, '[ACCOUNT-REDACTED]');
  cleanedText = cleanedText.replace(PII_PATTERNS.accountEndingIn, '[ACCOUNT-REDACTED]');
  cleanedText = cleanedText.replace(PII_PATTERNS.routingNumber, '[ROUTING-REDACTED]');
  cleanedText = cleanedText.replace(PII_PATTERNS.phone, '[PHONE-REDACTED]');
  cleanedText = cleanedText.replace(PII_PATTERNS.email, '[EMAIL-REDACTED]');

  return cleanedText;
}

export async function POST(request: NextRequest) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'parse-pdf/route.ts:14',message:'PDF upload started',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'parse-pdf/route.ts:22',message:'File received',data:{fileName:file.name,fileSize:file.size,fileType:file.type},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // PDF 파일 타입 확인
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { success: false, error: 'Please upload a valid PDF file' },
        { status: 400 }
      );
    }
    
    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }
    
    // PDF 파싱
    const arrayBuffer = await file.arrayBuffer();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'parse-pdf/route.ts:42',message:'Extracting text with unpdf',data:{bufferSize:arrayBuffer.byteLength},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // unpdf를 사용하여 PDF에서 텍스트 추출
    const result = await extractText(new Uint8Array(arrayBuffer));
    
    // text가 배열인 경우 join, 문자열인 경우 그대로 사용
    const rawText = Array.isArray(result.text) 
      ? result.text.join('\n') 
      : (typeof result.text === 'string' ? result.text : String(result.text));
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'parse-pdf/route.ts:50',message:'PDF text extracted',data:{isArray:Array.isArray(result.text),textLength:rawText?.length,totalPages:result.totalPages},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    
    // 민감한 개인정보만 제거 (텍스트는 AI에게 넘김)
    const cleanedText = removeSensitivePII(rawText);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'parse-pdf/route.ts:52',message:'PII removed, returning text to AI',data:{cleanedTextLength:cleanedText.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    
    // 텍스트를 그대로 반환 (AI가 처리하도록)
    return NextResponse.json({
      success: true,
      data: {
        text: cleanedText,
        totalPages: result.totalPages,
      },
    });
    
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'parse-pdf/route.ts:66',message:'PDF parsing error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    console.error('PDF parsing error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse PDF file' },
      { status: 500 }
    );
  }
}
