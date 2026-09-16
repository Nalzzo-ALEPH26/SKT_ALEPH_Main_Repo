# Mac 적용 순서

1. 다운로드한 ZIP 압축 해제
2. 안의 `simultaneous-omok` 폴더를 `SKT_ALEPH_Main_Repo/games/` 아래에 복사
3. 터미널 실행

```bash
cd ~/원하는경로/SKT_ALEPH_Main_Repo/simultaneous-omok
npm install
npm run dev
```

4. `http://localhost:5173` 접속
5. 방 생성 후 시크릿 창을 열어 같은 방 코드로 참가
6. 확인 후 저장소 루트로 이동해 commit/push

```bash
cd ~/원하는경로/SKT_ALEPH_Main_Repo
git status
git add simultaneous-omok
git commit -m "feat: add simultaneous omok multiplayer game"
git push
```
