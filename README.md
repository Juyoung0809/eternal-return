# eternal-return

이터널 리턴 캐릭터 · 아이템 · 맵 · 야생동물 도감 뷰어. React 프론트엔드와 Node.js 백엔드를 하나의 npm workspaces 모노레포로 관리합니다.

## 구조

```
eternal-return/
├─ frontend/   React + TypeScript + Vite, react-router-dom
└─ backend/    Node.js + Express + TypeScript, Prisma + SQLite
```

- `backend`는 `/api/characters`, `/api/items`, `/api/maps`, `/api/monsters` 목록/상세 REST 엔드포인트를 제공합니다.
- `frontend` 개발 서버(5173)는 `/api/*` 요청을 백엔드(4000)로 프록시합니다 (`frontend/vite.config.ts`).
- 데이터는 Prisma 스키마(`backend/prisma/schema.prisma`)로 정의되며 로컬 개발은 SQLite 파일 DB를 사용합니다.

## 시작하기

```bash
npm install                # 루트에서 두 워크스페이스 의존성 한번에 설치
npm run seed                # 최초 1회: DB 생성 + 샘플 데이터 시딩
npm run dev                  # 백엔드(4000) + 프론트엔드(5173) 동시 실행
```

브라우저에서 http://localhost:5173 접속.

개별 실행도 가능합니다: `npm run dev:backend`, `npm run dev:frontend`.

## 데이터 수정

- 스키마를 바꾸면: `backend/prisma/schema.prisma` 수정 후 `npx prisma migrate dev --name <설명>` (backend 디렉터리에서 실행). 로컬 SQLite 한정으로는 `npx prisma db push`도 가능합니다.
- `backend/prisma/seed.ts`는 DB를 처음 만들 때 쓰는 최소 예시 데이터입니다. 실제 도감 데이터는 아래 API 연동(`er:import`)으로 덮어씁니다.

## 이터널 리턴 공식 Open API 연동

캐릭터·아이템·야생동물 데이터는 [developer.eternalreturn.io](https://developer.eternalreturn.io) 공식 Open API(`/v2/data/{metaType}`)와 로컬라이제이션 텍스트 덤프에서 가져옵니다.

1. developer.eternalreturn.io 로그인 → **My Dashboard**에서 API 키 발급
2. `backend/.env`의 `ER_API_KEY`에 키 입력 (`.env.example` 참고)
3. `npm run er:import -w backend` 실행 — 캐릭터 91종(스킬 포함) · 아이템 808종(무기/방어구/특수/소비/재료) · 야생동물 46종을 실제 데이터로 upsert합니다.

**캐릭터 스킬 데이터 출처**: `/v2/data` 44개 테이블 어디에도 스킬 이름/설명은 없지만, 로컬라이제이션 텍스트 안에 `Skill/Group/{Name,Desc}/1{캐릭터코드:3자리}{100|200|300|400|500}` 형태의 미문서화 키로 패시브+스킬1~4가 다 들어있습니다(공식 문서엔 없고 재키 스킬명으로 역추적해서 찾음). 90/91 캐릭터를 커버하고, 아직 미출시인 1명만 상세 화면에 "스킬 정보는 준비 중입니다"로 표시됩니다.

설명 텍스트의 `{0}`, `{1}` 같은 자리는 게임 클라이언트가 레벨별 수치표(공격력 계수 등)로 채우는 부분인데, 이 수치는 **공식 API 어디에도 없다는 걸 확인했습니다** — `/v2/data` 44개 테이블은 물론, l10n 텍스트의 `ToolTipType/*`, `ToolTipCoef/*` 키들도 "이 수치가 뭘 의미하는지" 이름표(예: `ToolTipType/DeadEyeApCoef` → "데드아이 공격력 계수")만 있을 뿐 실제 숫자는 없습니다. 그래서 `{n}` 자리는 값을 채우지 못하고 `importErData.ts`의 `cleanSkillText`에서 아예 제거합니다 — 문장이 살짝 어색해지는 대신("초 동안", "의 스킬 피해") 원본처럼 중괄호가 노출되지는 않습니다.

**아이템 목록 필터**: `/api/items`는 DB의 모든 아이템을 보여주지 않습니다 — 무기/방어구는 영웅 등급(4) 이상만, 특수/소비는 등급 무관 전부 표시합니다(`backend/src/routes/items.ts`). 낮은 등급 무기·방어구와 `ItemMisc`(못, 미스릴 같은 기초 재료 62종)는 목록엔 안 뜨지만 DB엔 그대로 있어서, 고급 장비 상세 화면의 "제작법"에서는 정상적으로 연결됩니다 — `ItemMisc`를 빼먹었을 때는 재료 2개 중 1개만 연결되는 문제가 있었는데, 추가하고 나서 영웅 등급 이상 무기/방어구 488종 전부 재료 2개가 정확히 채워지는 것까지 확인했습니다.

**제작법(조합 트리)**: 아이템 상세 화면에서 "제작법"을 누르면 재료가 피라미드 형태로 몇 단계든(관찰상 최대 4단계) 내려가며 전부 보입니다 — `backend/src/routes/items.ts`의 `GET /items/:id`가 `materials`를 4단계 중첩(`include`)으로 가져오고, `frontend/src/components/RecipeTree.tsx`가 이를 재귀적으로 렌더링합니다. dak.gg에서 정확히 이 형태의 조합 트리 페이지를 찾지는 못해서(있는 건 능력치 툴팁과 빌드 순서 아이콘 정도), 같은 카드/아이콘 시각 언어로 직접 구성했습니다. "상위 조합 아이템"(이 재료로 무엇을 만들 수 있는지)은 한 단계만 보여줍니다 — 위로 올라가는 방향은 한 아이템이 수십 개의 상위 아이템에 쓰이기도 해서 재귀시키면 폭발적으로 커집니다.

**알려진 한계**
- 맵 데이터는 API에 없어서 `아이스브레이커 섬` 한 개만 수동 시드로 유지하고, 모든 야생동물을 그 맵에 연결합니다.
- 몬스터 드랍 아이템(`dropInfo`)은 아직 연동 안 함(DropGroup/MonsterDropGroup 테이블 조인이 필요).
- 공식 API는 문서화된 rate limit이 없고 429가 자주 떠서, `erApiClient.ts`에 지수 백오프 재시도가 들어가 있습니다.

관련 코드: `backend/src/services/erApiClient.ts`(API 클라이언트, 재시도 포함) · `backend/scripts/fetchErData.ts`(원본 응답을 `backend/data/raw/*.json`으로 덤프하는 진단용 스크립트) · `backend/scripts/importErData.ts`(실제 DB에 upsert하는 스크립트).

## 캐릭터 이미지

공식 API에는 이미지가 전혀 없습니다. 커뮤니티 미디어킷(Google Drive, `CharactER/{캐릭터명}/...` 구조)에서 가져옵니다:

- 썸네일: `CharactER/{캐릭터명}/02. Default/{캐릭터명}_Mini_00.png`
- 스킬 아이콘: `CharactER/{캐릭터명}/03. Skill Icon/`
- 스킨: `CharactER/{캐릭터명}/{스킨명}/{스킨명}_Full_00.png`

파일을 내려받아 레포에 넣지 않고, 파일이 "링크가 있는 모든 사용자"로 공유돼 있다는 걸 확인한 뒤 `https://lh3.googleusercontent.com/d/{fileId}=w500` 형태로 **직접 링크**해서 `Character.imageUrl`에 저장합니다 (`backend/scripts/setSampleImages.ts` 참고, 지금은 재키·매그너스 2명만 샘플로 연결됨).

**한계**: 이 세션에 연결된 Drive 계정은 실제로 열어본 적 있는 파일만 검색이 되고, 폴더를 통째로 나열해도 일부만 보입니다. 그래서 파일명 규칙을 정확히 알아도 전체 91명을 한 번에 자동으로 찾아 연결하는 건 안 됩니다 — 계정에서 해당 폴더를 한 번씩 열람해 두면 검색되기 시작할 가능성이 있습니다.

## 빌드

```bash
npm run build   # backend(tsc) + frontend(vite build)
```
