# Budget Tracker - AI 기반 가계부 웹앱

PDF 은행 명세서를 업로드하면 AI가 자동으로 카테고리별로 분류해주는 스마트 가계부 웹 애플리케이션입니다.

## 주요 기능

- **PDF 업로드**: 은행 명세서 PDF를 업로드하면 자동으로 거래 내역 추출
- **AI 카테고리 분류**: OpenAI GPT를 사용하여 거래 내역을 자동 분류
- **개인정보 보호**: 계좌번호, 전화번호, 주소 등 민감한 정보 자동 제거
- **드래그앤드롭**: 카테고리 간 거래 항목을 쉽게 이동
- **시각화 대시보드**: 파이 차트, 바 차트로 지출 현황 한눈에 확인
- **데이터 암호화**: 거래 내역을 암호화하여 Firestore에 안전하게 저장
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원

## 기술 스택

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Firebase Authentication, Firestore
- **AI**: OpenAI API (GPT-3.5-turbo)
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **Deployment**: Vercel

## 시작하기

### 1. 필수 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Firebase 프로젝트
- OpenAI API 키

### 2. Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. **Authentication** 활성화
   - "Sign-in method" 탭에서 "Email/Password" 활성화
3. **Firestore Database** 생성
   - "Cloud Firestore" 선택
   - 프로덕션 모드로 시작
4. **웹 앱 추가**
   - 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가
   - Firebase SDK 설정 값을 복사

### 3. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/) 로그인
2. API Keys 섹션에서 새 API 키 생성
3. 키를 안전한 곳에 복사

### 4. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 값을 입력:

```bash
# Firebase 설정
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# OpenAI API
OPENAI_API_KEY=sk-your_openai_api_key

# 암호화 키 (32자 이상 랜덤 문자열)
ENCRYPTION_KEY=your_32_character_encryption_key
```

암호화 키 생성 (터미널에서):
```bash
openssl rand -base64 32
```

### 5. Firebase Security Rules 설정

Firebase Console > Firestore Database > Rules에서 다음 규칙 적용:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자는 자신의 데이터만 접근 가능
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 6. 의존성 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## Vercel 배포

### 1. GitHub에 코드 업로드

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/money-budget.git
git push -u origin main
```

### 2. Vercel 배포

1. [Vercel](https://vercel.com/)에 로그인
2. "Import Project" 클릭
3. GitHub 저장소 선택
4. **Environment Variables** 설정:
   - `.env.local`의 모든 환경 변수를 Vercel에 추가
5. "Deploy" 클릭

### 3. Firebase 도메인 허용

1. Firebase Console > Authentication > Settings
2. "Authorized domains"에 Vercel 배포 URL 추가 (예: `your-app.vercel.app`)

## 폴더 구조

```
/src
├── /app                    # Next.js App Router 페이지
│   ├── /api               # API 라우트
│   │   ├── /parse-pdf     # PDF 파싱 API
│   │   └── /categorize    # AI 카테고리 분류 API
│   ├── /dashboard         # 대시보드 페이지
│   ├── /login            # 로그인 페이지
│   ├── /signup           # 회원가입 페이지
│   ├── /upload           # PDF 업로드 페이지
│   └── /review           # 거래 확인/수정 페이지
├── /components           # React 컴포넌트
│   ├── /Charts          # 차트 컴포넌트
│   └── ...
├── /hooks               # 커스텀 React 훅
├── /lib                 # 유틸리티 함수
│   ├── firebase.ts      # Firebase 초기화
│   ├── firestore.ts     # Firestore CRUD
│   ├── encryption.ts    # 암호화 유틸리티
│   └── categories.ts    # 카테고리 정의
└── /types               # TypeScript 타입 정의
```

## 사용 방법

1. **회원가입/로그인**: 이메일과 비밀번호로 계정 생성
2. **PDF 업로드**: 은행 명세서 PDF 파일 업로드
3. **AI 분류 확인**: AI가 분류한 결과를 확인하고 필요시 드래그앤드롭으로 수정
4. **저장**: "Confirm All" 버튼으로 거래 내역 저장
5. **대시보드**: 차트와 그래프로 지출 현황 확인

## 보안

- 모든 거래 내역은 AES 암호화 후 저장
- PDF에서 개인정보(계좌번호, 전화번호, 주소, SSN) 자동 제거
- Firebase Security Rules로 사용자별 데이터 격리
- 환경 변수로 API 키 관리

## 문제 해결

### PDF 파싱이 안 될 때
- PDF가 텍스트 기반인지 확인 (이미지 PDF는 지원하지 않음)
- 파일 크기가 10MB 이하인지 확인

### OpenAI API 에러
- API 키가 올바른지 확인
- OpenAI 계정에 크레딧이 있는지 확인

### Firebase 연결 오류
- 환경 변수가 올바르게 설정되었는지 확인
- Firebase 프로젝트 설정이 올바른지 확인

## 라이선스

MIT License






feedback from Jae
- ai가 매달 분석해서 그 다음달 또는 지금 어떻게 돈 관리를 더 잘 할 수 있는지?
- 소비 패턴을 분석해서 돈을 아끼거나 절약할 수 있는 방안 제안
- ai 기능을 누르면 이런 피드백 제공과 동시에 어떤 부분이 발전했는지 칭찬
