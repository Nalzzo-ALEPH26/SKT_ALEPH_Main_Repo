# GitHub → Cloudflare 배포 순서

이 프로젝트는 React/Vinext 화면, Worker API, D1 데이터베이스로 구성됩니다.
GitHub Pages만으로는 서버 API와 방 상태를 실행할 수 없습니다.
GitHub는 코드 관리, Cloudflare Workers와 D1은 실행 환경으로 사용합니다.
현재 ChatGPT 사이트의 방 데이터는 새 Cloudflare 계정으로 복사되지 않습니다.

## 1. GitHub에 코드 업로드

압축을 풀고 GitHub Desktop에서 `File → Add local repository`로 폴더를 선택합니다.
Git 저장소가 아니라는 안내가 나오면 새 저장소를 생성하고 초기 커밋 후 Publish repository를 누릅니다.
저장소 이름 예시: `nunchi-omok`. ZIP 자체가 아닌 압축을 푼 소스를 올리세요.
`.gitignore`와 `.openai/hosting.json`도 포함해야 합니다.
node_modules, dist, .env, .wrangler, 생성한 cloudflare.deploy.json은 올리지 않습니다.

## 2. 로컬 도구 준비

Node.js 22.13 이상과 package.json의 packageManager 버전에 맞는 pnpm을 설치합니다.
프로젝트 폴더에서:

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler d1 create nunchi-omok-db
```

마지막 명령으로 나온 실제 database_id를 기록합니다. 아래 YOUR_DATABASE_ID는 그 값으로 바꿉니다.

## 3. 첫 배포

```bash
pnpm exec vinext build
node scripts/prepare-cloudflare.mjs YOUR_DATABASE_ID
pnpm exec wrangler d1 migrations apply DB --remote --config cloudflare.deploy.json
pnpm exec wrangler deploy --config cloudflare.deploy.json
```

본인의 Cloudflare 계정에 데이터베이스를 생성하고 마이그레이션한 뒤 Worker를 배포합니다.
스크립트는 Sites의 임시 DB 식별자를 쓰지 않고 본인의 ID를 사용합니다.
배포 명령이 반환한 workers.dev 주소에서 테스트하세요.

## 4. GitHub 자동 배포 연결

Cloudflare Workers & Pages에서 배포한 `nunchi-omok` Worker를 열고,
Settings → Builds에서 GitHub 저장소와 main 브랜치를 연결합니다.
빌드 환경 변수 `CLOUDFLARE_D1_DATABASE_ID`에 실제 database_id를 설정합니다.

빌드 명령:
```bash
pnpm exec vinext build && node scripts/prepare-cloudflare.mjs
```

배포 명령:
```bash
pnpm exec wrangler d1 migrations apply DB --remote --config cloudflare.deploy.json && pnpm exec wrangler deploy --config cloudflare.deploy.json
```

저장소 루트를 빌드 루트로 사용합니다. 이후 main에 push하면 자동 배포됩니다.
현재 ChatGPT 사이트는 별도 배포이므로 GitHub push만으로 함께 갱신되지 않습니다.
배포용 Cloudflare 토큰을 소스에 직접 넣지 마세요.

## 검증 상태

게임 규칙과 API 검증, 로컬 빌드는 확인했습니다.
사용자 Cloudflare 계정에서의 외부 배포는 아직 실행하지 않았습니다.

공식 문서:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/d1/wrangler-commands/
