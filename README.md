# EduStudio

AI 이러닝 콘텐츠 자동화 플랫폼

## 배포 방법 (Vercel)

### 1. GitHub에 올리기
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/본인계정/edustudio.git
git push -u origin main
```

### 2. Vercel 배포
1. vercel.com 접속 → New Project
2. GitHub 저장소 선택 → Import
3. Environment Variables 설정:
   - `ANTHROPIC_API_KEY` = sk-ant-...
   - `ELEVENLABS_API_KEY` = sk-...
4. Deploy 클릭

### 3. 로컬 개발
```bash
# .env.local 파일 생성
cp .env.local.example .env.local
# API Key 입력 후 저장

npm install
npm run dev
# http://localhost:3000 접속
```

## 기술 스택
- Next.js 14 (Pages Router)
- Vercel (배포 + API Routes)
- Claude API (시나리오 생성)
- ElevenLabs API (음성 생성)
