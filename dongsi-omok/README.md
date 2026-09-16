# 동시 오목 (Simultaneous Omok)

https://dongsi-omok.vercel.app/

2~6명이 브라우저에서 같은 방에 접속해 플레이하는 실시간 오목 변형 게임입니다.

## 확정 규칙

- 보드: 15×15
- 인원: 2~6명
- 게임 시작 시 플레이 순서를 무작위로 정합니다.
- 초기 착수는 순서대로 진행하며, 각 플레이어가 빈 칸에 돌 3개를 놓습니다.
- 초기 착수가 끝나면 동시 라운드가 시작됩니다.
- 매 라운드 선택 시간은 15초입니다.
- 각 플레이어는 빈 칸 최대 5곳을 비공개로 선택합니다.
- READY를 누르면 해당 라운드 선택을 수정할 수 없습니다.
- 모두 READY이거나 15초가 끝나면 서버가 선택을 동시에 공개/판정합니다.
- 같은 칸을 2명 이상 선택하면 그 칸은 충돌로 처리되어 누구의 돌도 놓이지 않습니다.
- 충돌하지 않은 위치의 돌만 동시에 보드에 반영됩니다.
- 가로/세로/대각선으로 5개 이상 연결하면 승리합니다.
- 같은 라운드에서 여러 명이 5목을 완성하면 공동 승리입니다.
- 게임 시작 후 신규 참가자는 받지 않습니다.
- 브라우저가 잠시 끊긴 기존 플레이어는 저장된 playerId로 재접속할 수 있습니다.

## 구조

```text
client/                 React + Vite 웹 UI
server/src/index.ts     Express + Socket.IO 실시간 서버
server/src/game/        서버 권위형 게임 엔진/방 상태 머신
tests/                  의존성 없는 핵심 게임 규칙 테스트
```

게임 상태는 서버가 최종 결정합니다. 클라이언트는 아직 공개되지 않은 상대의 선택 좌표를 받을 수 없습니다.

## Mac에서 실행

Node.js 20 이상을 권장합니다.

```bash
cd simultaneous-omok
npm install
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:5173
```

개발 서버는 다음 두 프로세스를 함께 실행합니다.

```text
Vite client       http://localhost:5173
Socket.IO server  http://localhost:3001
```

### 동시접속 로컬 테스트

같은 Mac에서 일반 창 + 시크릿 창을 여러 개 열어 각각 다른 닉네임으로 같은 방에 참가하면 됩니다.

다른 기기에서도 테스트하려면 서버/클라이언트를 외부에서 접근 가능한 주소에 배포해야 합니다.

## 테스트

```bash
npm test
```

검증 항목:

- 15×15 보드
- 최대 6명
- 게임 시작 최소 2명
- 초기 3개 순차 착수
- 라운드 15초
- 최대 5개 비공개 선택
- 중복 좌표 충돌 무효
- 5목 이상 및 공동 승리

전체 프로덕션 빌드:

```bash
npm run build
```

## Socket.IO 주요 이벤트

### 클라이언트 → 서버

```text
room:create
room:join
room:reconnect
room:leave
game:start
initial:place
round:update-selection
round:ready
game:restart
```

### 서버 → 클라이언트

```text
room:state
round:resolved
room:closed
```

`round:update-selection`으로 받은 좌표는 해당 플레이어의 서버 상태에만 저장하고 다른 사용자에게 broadcast하지 않습니다.

## 배포 예시

### 프론트: Vercel

Vercel 프로젝트 Root Directory를 다음으로 지정합니다.

```text
simultaneous-omok
```

환경변수:

```text
VITE_SOCKET_URL=https://<Railway 서버 주소>
```

이 프로젝트의 `vercel.json`이 `npm run build:client`와 `dist-client`를 사용합니다.

### 서버: Railway

Railway 서비스 Root Directory:

```text
simultaneous-omok
```

환경변수:

```text
CLIENT_ORIGIN=https://<Vercel 프론트 주소>
PORT=3001
```

Railway는 실제 실행 환경에서 `PORT`를 자동 제공할 수 있으므로 배포 시 Railway 값이 우선됩니다. 프론트 주소가 여러 개라면 쉼표로 구분할 수 있습니다.

```text
CLIENT_ORIGIN=https://game.vercel.app,http://localhost:5173
```

서버 상태 확인:

```text
GET /health
```

## 기존 GitHub 저장소에 넣기

ZIP을 풀면 `simultaneous-omok/` 구조가 들어 있습니다. 기존 저장소 루트에서 그대로 복사한 뒤:

```bash
git checkout -b feat/simultaneous-omok
git add simultaneous-omok
git commit -m "feat: add simultaneous omok multiplayer game"
git push -u origin feat/simultaneous-omok
```

조원이 같은 경로를 이미 수정 중이면 먼저 조원의 최신 브랜치를 pull한 뒤 필요한 파일 단위로 병합하는 편이 안전합니다.

## MVP 제한

- 방 상태는 서버 메모리에만 저장합니다. 서버가 재시작되면 진행 중인 방은 사라집니다.
- 관전자/랭킹/계정/전적 DB는 구현하지 않았습니다.
- 초기 착수 단계에는 별도의 제한 시간이 없습니다.
- 서버를 여러 인스턴스로 수평 확장하려면 이후 Redis Adapter 등의 공유 상태 계층이 필요합니다.
