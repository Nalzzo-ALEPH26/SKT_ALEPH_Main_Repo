# 동시 오목 (Dongsi Omok)

https://dongsi-omok.vercel.app/

2~6명이 브라우저에서 같은 방에 접속해 플레이하는 실시간 오목 변형 게임입니다.

## 확정 규칙

- 보드: 15×15
- 인원: 2~6명
- 게임 시작 시 플레이 순서를 무작위로 정합니다.
- 초기 착수는 순서대로 진행하며 각 플레이어가 빈 교차점에 돌 3개를 놓습니다.
- 초기 착수가 끝나면 동시 라운드가 시작됩니다.
- 매 라운드 선택 시간은 15초입니다.
- 각 플레이어는 빈 교차점 최대 5곳을 비공개로 선택합니다.
- READY를 누르면 해당 라운드 선택을 수정할 수 없습니다.
- 모두 READY이거나 15초가 끝나면 서버가 선택을 동시에 공개/판정합니다.
- 같은 위치를 2명 이상 선택하면 해당 위치는 충돌로 처리되어 누구의 돌도 놓이지 않습니다.
- 충돌하지 않은 돌만 동시에 보드에 반영됩니다.
- 가로/세로/대각선으로 5개 이상 연결하면 승리합니다.
- 같은 라운드에서 여러 명이 5목을 완성하면 공동 승리입니다.
- 게임 시작 후 신규 참가자는 받지 않습니다.
- 기존 플레이어는 저장된 playerId로 Socket.IO 재접속을 시도합니다.

## 구조

```text
client/                 React + Vite 웹 UI
api/socket.ts           Vercel WebSocket Function 진입점
server/src/socketServer.ts
                        Socket.IO 방/게임 서버
server/src/index.ts     localhost 개발용 Node 서버
server/src/game/        서버 권위형 게임 엔진/방 상태 머신
tests/                  핵심 규칙/UI/Vercel 배포 테스트
```

프론트와 Socket.IO가 같은 Vercel 도메인을 사용하므로 별도의 `VITE_SOCKET_URL`이나 CORS 서버 주소가 필요하지 않습니다.

## Mac 로컬 실행

Node.js 20 이상을 권장합니다.

```bash
cd dongsi-omok
npm install
npm run dev
```

브라우저:

```text
http://localhost:5173
```

개발 중에는 Vite가 `/api/socket` 요청을 `localhost:3001`의 Socket.IO 개발 서버로 프록시합니다.

## 테스트

```bash
npm test
```

검증 항목:

- 15×15 교차점 보드
- 어두운 SF/HUD UI
- 2~6명
- 초기 3개 순차 착수
- 라운드 15초
- 최대 5개 비공개 선택
- 중복 좌표 충돌 무효
- 5목 이상 및 공동 승리
- Vercel `/api/socket` 단일 도메인 배포 설정

## Vercel 단독 배포

이 프로젝트는 Vercel WebSocket Public Beta를 사용하는 구조입니다.

GitHub 저장소가 다음 구조라면:

```text
SKT_ALEPH_Main_Repo/
└── dongsi-omok/
```

Vercel Dashboard에서 저장소를 Import한 뒤 **Root Directory**를 아래 값으로 지정합니다.

```text
dongsi-omok
```

별도 환경변수는 필요하지 않습니다.

Vercel은 `vercel.json`을 통해:

- Vite 클라이언트 빌드
- `dist-client` 정적 배포
- `api/socket.ts` WebSocket Function
- Fluid Compute
- Seoul(`icn1`) Function region
- Function 최대 실행시간 300초

를 사용합니다.

### Git 연결 없이 폴더만 CLI로 배포

Vercel Dashboard에서 GitHub Organization 저장소 Import가 제한되는 경우 로컬 프로젝트 폴더만 직접 배포할 수 있습니다.

```bash
cd ~/Desktop/SKT_ALEPH_Work/SKT_ALEPH_Main_Repo/dongsi-omok
npm install
npx vercel
```

프로덕션 배포:

```bash
npx vercel --prod
```

이 방식은 `SKT_ALEPH_Main_Repo`의 다른 폴더를 업로드하지 않고 현재 `dongsi-omok` 프로젝트 디렉터리를 Vercel 프로젝트로 배포합니다.

## Vercel WebSocket MVP 제한

현재 방 상태는 Function 프로세스 메모리에 저장됩니다. 따라서 이 버전은 수업/사이드 프로젝트 데모용 MVP에 적합하며 다음 제한이 있습니다.

- Vercel Hobby의 Function 최대 실행시간은 300초이므로 장시간 연결은 재연결될 수 있습니다.
- Function 인스턴스가 종료되면 메모리에 있던 진행 중 방은 사라질 수 있습니다.
- 트래픽 증가로 여러 Function 인스턴스가 동시에 생성될 경우 인메모리 Room 상태 공유가 보장되지 않습니다.

안정적인 장기 운영 버전에서는 Redis/pub-sub 또는 별도 실시간 상태 저장 계층을 추가해야 합니다.
