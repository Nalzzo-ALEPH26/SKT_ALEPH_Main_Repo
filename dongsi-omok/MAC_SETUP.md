# Mac 적용 및 Vercel 배포

## 1. 저장소 위치

```bash
cd ~/Desktop/SKT_ALEPH_Work/SKT_ALEPH_Main_Repo/dongsi-omok
```

## 2. 로컬 실행

```bash
npm install
npm run dev
```

브라우저:

```text
http://localhost:5173
```

## 3. Git 반영

```bash
cd ~/Desktop/SKT_ALEPH_Work/SKT_ALEPH_Main_Repo
git add dongsi-omok
git status
git commit -m "feat: add Vercel-ready dongsi omok multiplayer game"
git push origin main
```

## 4-A. Vercel Dashboard에서 GitHub 연동 배포

1. Vercel → Add New → Project
2. `Nalzzo-ALEPH26/SKT_ALEPH_Main_Repo` 선택
3. Import 화면에서 Root Directory의 Edit 선택
4. `dongsi-omok` 선택
5. Framework Preset은 Vite로 확인
6. Deploy

Vercel은 `dongsi-omok/vercel.json` 설정을 사용합니다.

## 4-B. GitHub 연결 없이 현재 게임 폴더만 배포

```bash
cd ~/Desktop/SKT_ALEPH_Work/SKT_ALEPH_Main_Repo/dongsi-omok
npx vercel
```

처음 실행 시 Vercel 로그인을 진행하고 프로젝트를 생성/연결합니다.

프로덕션:

```bash
npx vercel --prod
```
