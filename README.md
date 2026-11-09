# eternal-return

이터널 리턴 캐릭터 · 아이템 · 루트 도감 뷰어. React 프론트엔드와 Node.js 백엔드를 하나의 npm workspaces 모노레포로 관리합니다.

## 구조

```
eternal-return/
├─ frontend/   React + TypeScript + Vite, react-router-dom
└─ backend/    Node.js + Express + TypeScript, Prisma + SQLite
```

- `backend`는 `/api/characters`, `/api/items`, `/api/routes` 목록/상세 REST 엔드포인트를 제공합니다.
- `frontend` 개발 서버(5173)는 `/api/*` 요청을 백엔드(4000)로 프록시합니다 (`frontend/vite.config.ts`).
- 데이터는 Prisma 스키마(`backend/prisma/schema.prisma`)로 정의되며 로컬 개발은 SQLite 파일 DB를 사용합니다.

## 시작하기

```bash
npm install                          # 루트에서 두 워크스페이스 의존성 설치 (+ prisma generate)
cp backend/.env.example backend/.env # 최초 1회: 환경변수 파일 생성 (새 PC마다 필요, git에 안 올라감)
npm run seed                         # 최초 1회: 마이그레이션 적용(DB 생성) + 데이터 채우기(스냅샷이 있으면 실제 데이터 복원)
npm run dev                  # 백엔드(4000) + 프론트엔드(5173) 동시 실행
```

브라우저에서 http://localhost:5173 접속.

개별 실행도 가능합니다: `npm run dev:backend`, `npm run dev:frontend`.

참고:
- Node.js 22.13 이상이 필요합니다(`seed`의 스냅샷 복원이 Node 내장 `node:sqlite`를 씁니다).
- 다른 PC에서는 `npm install` → `cp backend/.env.example backend/.env` → `npm run seed`만 하면 `backend/prisma/snapshot.db.gz`에서 전체 데이터가 복원됩니다. API 키는 데이터를 새로 받을 때(`er:*` 스크립트)만 필요합니다.
- Prisma CLI 설정은 `backend/prisma.config.ts`에 있습니다(예전 `package.json#prisma` 대신). 이 파일이 있으면 CLI가 `.env`를 스스로 읽지 않아서 설정 파일이 `dotenv`를 불러옵니다.
- npm 11은 의존성의 설치 스크립트를 기본으로 막습니다. 꼭 필요한 것(esbuild, prisma 엔진 내려받기 등)만 루트 `package.json`의 `allowScripts`에 허용해 두었습니다.
- Prisma CLI가 쓰는 `deepmerge-ts`의 보안 취약점(GHSA-ggr8-5vv4-36mx)은 Prisma 7로 올리지 않고 루트 `package.json`의 `overrides`로 고쳐진 8.x를 쓰게 했습니다.
- `prisma generate`나 `npm install`이 Windows에서 `EPERM ... query_engine-windows.dll.node`로 실패하면, 개발 서버가 그 파일을 잡고 있는 것이니 서버를 끄고 다시 실행하세요.

## 데이터 수정

- 스키마를 바꾸면: `backend/prisma/schema.prisma` 수정 후 `npx prisma migrate dev --name <설명>` (backend 디렉터리에서 실행). 로컬 SQLite 한정으로는 `npx prisma db push`도 가능합니다.
- `backend/prisma/seed.ts`는 DB를 처음 만들 때 쓰는 최소 예시 데이터입니다. 실제 도감 데이터는 아래 API 연동(`er:import`)으로 덮어씁니다.

## 이터널 리턴 공식 Open API 연동

캐릭터·아이템·루트 데이터는 [developer.eternalreturn.io](https://developer.eternalreturn.io) 공식 Open API(`/v2/data/{metaType}`, `/v1/weaponRoutes/recommend`)와 로컬라이제이션 텍스트 덤프에서 가져옵니다.

1. developer.eternalreturn.io 로그인 → **My Dashboard**에서 API 키 발급
2. `backend/.env`의 `ER_API_KEY`에 키 입력 (`.env.example` 참고)
   - `npm run er:check -w backend`로 키가 유효한지 요청 1번만 보내서 바로 확인할 수 있습니다.
3. 아래 순서로 실행합니다(뒤의 두 개는 캐릭터가 DB에 있어야 해서 `er:import` 다음에).
   - `npm run er:import -w backend` — 캐릭터 91종(스킬·포지션 포함) · 아이템 809종(무기/방어구/특수/소비/재료) · 특성 48종 · 전술 스킬을 upsert합니다. API에 더 이상 없는 행(시드 샘플 데이터 포함)은 삭제합니다. 1분 내외.
   - `npm run er:routes -w backend` — 공유 루트 전체(2026-10 기준 약 4만 6천 개, 500여 페이지)를 동기화합니다. 10~15분 걸립니다. `ROUTE_MAX_PAGES=5`로 일부만 받아 빠르게 확인할 수 있습니다(이때는 오래된 루트를 지우지 않음).
   - `npm run er:images -w backend` — 팬키트에서 실험체 프로필·전신·스킨·스킬 아이콘과 아이템·특성·전술 스킬 아이콘을 연결합니다(아래 "이미지"). 몇 분 걸립니다. `-- --icons-only`를 붙이면 실험체 이미지는 건너뜁니다.
   - `npm run db:snapshot -w backend` — 다 받은 DB를 `backend/prisma/snapshot.db.gz`(압축, 약 7MB)로 저장합니다. 이후 `npm run seed`나 `prisma migrate reset`(초기화 뒤 seed가 자동 실행됨)을 하면 API를 다시 부르지 않고 이 스냅샷에서 전체 데이터가 복원됩니다(`backend/prisma/snapshot.ts`, Node 내장 `node:sqlite` 사용). 스냅샷이 없으면 seed는 예전처럼 샘플 데이터만 넣습니다.

**캐릭터 스킬 데이터 출처**: `/v2/data` 44개 테이블 어디에도 스킬 이름/설명은 없지만, 로컬라이제이션 텍스트 안에 `Skill/Group/{Name,Desc}/1{캐릭터코드:3자리}{100|200|300|400|500}` 형태의 미문서화 키로 패시브+스킬1~4가 다 들어있습니다(공식 문서엔 없고 재키 스킬명으로 역추적해서 찾음). 2026-10 기준 91명 전원을 커버합니다(키가 없는 캐릭터는 상세 화면에 "스킬 정보는 준비 중입니다"로 표시).

설명 텍스트의 `{0}`, `{1}` 같은 자리는 게임 클라이언트가 레벨별 수치표(공격력 계수 등)로 채우는 부분인데, 이 수치는 **공식 API 어디에도 없다는 걸 확인했습니다** — `/v2/data` 44개 테이블은 물론, l10n 텍스트의 `ToolTipType/*`, `ToolTipCoef/*` 키들도 "이 수치가 뭘 의미하는지" 이름표(예: `ToolTipType/DeadEyeApCoef` → "데드아이 공격력 계수")만 있을 뿐 실제 숫자는 없습니다. 대신 스킬 상세는 숫자 없이도 완결된 다음 l10n 키들을 조합합니다.
- 설명: `Skill/LobbyDesc/{코드}` — 게임 로비에서 보여주는, 수치 자리 없이 완성된 문장. 없으면 `Skill/Group/Desc`의 `{n}`을 "일정 시간/일정 수치"로 바꿔 씁니다.
- 피해 계수: `Skill/Group/Coef`의 `(+공격력의 {1})` 같은 부분에서 계수 이름(공격력, 대상 현재 체력 등)만 뽑습니다.
- 참고: `Skill/Group/ExpansionTip` (세부 동작 설명).
- 다른 형태·연계: 한 키에 여러 형태가 있는 스킬(2타, 강화형, 취재 중/방송 중, 띠아의 색깔별 스킬 등)은 같은 슬롯 범위의 `…10`, `…20` … 코드에 있어서 모두 모아 보여줍니다. 이름만 같은 재시전 코드는 하나로 합치고, 설명이 본 스킬과 같으면 이름만 적습니다. 본 스킬은 설명이 있는 첫 코드로 정하는데, `…00`이 없는 경우(다니엘 R은 `…10`부터)도 있습니다. 슬롯 그룹도 보통 1~5(`1{코드}100`~`500`)지만 띠아처럼 1·4·5·6·7을 쓰는 실험체가 있어서, 실험체가 실제로 가진 그룹 5개를 순서대로 P/Q/W/E/R에 붙입니다.

**실험체 무기**: 실험체 상세의 "무기"는 공식 `CharacterAttributes`의 무기별 5가지 평가(공격·방어·방해·이동·지원, 각 1~5)를 오각형 그래프로, 조작 난이도(1~5), 게임 안 무기 안내 문구(`CharacterGuide/{실험체}/{무기}`), 무기 스킬(D)을 보여줍니다. 무기 스킬은 `Skill/Group/*/{3000000 + 숙련도 코드 × 1000}`(단검 15 → 3015000)에 있고, 아이콘은 팬키트 `★Weapon Skill` 폴더에서 영문 이름으로 찾습니다(`WeaponType`, `CharacterWeapon` 테이블, 숙련도 코드표는 `backend/scripts/masteryCodes.ts`).

**아이템 화면**: 아이템마다 따로 상세 페이지를 두지 않고, dak.gg처럼 한 화면에서 작은 아이콘 목록과 오른쪽 상세 패널로 봅니다(`/items?cat=&slot=&weapon=&grade=&item=`, 필터와 선택한 아이템이 URL에 남음). 분류는 장비(부위: 무기·옷·머리·팔/장식·다리, 무기는 다시 무기 종류별 — 같은 등급 안에서도 이 순서로 나열) / 소비 / 특수이며, 목록은 등급별(초월 → 일반)로 묶여 나오고 특수의 무기 보급 상자 4종은 따로 묶습니다. `GET /api/items`는 모든 등급의 아이템을 가벼운 필드만 담아 한 번에 주고, 필터링은 화면에서 합니다. 장비에는 **특수 재료** 필터(조합 트리 어딘가에 4등급 기초 재료 — 운석·생명의 나무·미스릴·포스 코어·VF 혈액 샘플·진화의 돌 — 가 들어가는 아이템, `specialMaterials`)와 **능력치** 필터(여러 개 고르면 모두 가진 아이템만, `statKeys`를 `frontend/src/constants.ts`의 `STAT_CATEGORIES`로 묶어 공격력·스킬 증폭·최대 체력 등으로 표시)가 있습니다(`?special=`, `?stat=공격력,치명타`). **적응형 능력치**는 공식 데이터에 숫자 하나(`adaptiveForce`, 표기 "공격력 또는 스킬 증폭")만 있고 변환 비율이 없어서, 게임 안에서 직접 확인한 비율(1 → 공격력 1 또는 스킬 증폭 2, 2026-10 기준)로 두 값을 함께 보여주며 능력치 필터에서도 공격력·스킬 증폭 양쪽에 걸립니다. 패치로 비율이 바뀌면 `frontend/src/constants.ts`의 `ADAPTIVE_FORCE_RATE`만 고치면 됩니다. 재료 아이템과 볼 필요 없는 일부(현상금·크레딧류, 모닥불, 아글라이아의 선물 - 고급, 위장 카메라와 그 재료용 망원 카메라), 그리고 팬키트에 이미지가 없는 아이템(카드모스의 부름 Lv2·Lv3, SCV 등)은 목록에서만 빼고(`HIDDEN_TYPES`/`HIDDEN_CODES` in `backend/src/routes/items.ts`) DB에는 남겨 두어서, 조합 트리에서 누르면 상세 패널은 그대로 열립니다. 부위/무기 종류는 `ItemArmor.armorType`·`ItemWeapon.weaponType`을 `Item.subType`에 저장한 것이고, 모닥불은 공식 데이터에서 음식 11종의 재료로 잡혀 있지만 요리 도구라서 조합법에서 뺍니다(`NON_INGREDIENT_CODES`), 효과 문구는 `Item/Effects`, 배경 설명은 `Item/Help` l10n 키에서 가져옵니다. 상세 패널의 "획득처"와 조합 트리 재료의 마우스 호버 카드는 그 아이템이 나오는 지역(`ItemSpawn` → `Area`)과 떨어뜨리는 야생동물(`MonsterDropGroup` → `DropGroup`, 변이·잠식 변이는 같은 동물이 있으면 합침)을 보여줍니다(`Item.spawnAreas`/`droppedBy`, `er:import`에서 채움). 지역 안의 어느 상자인지는 다루지 않습니다. 다른 화면(루트의 목표 아이템, 조합 트리)의 아이템을 누르면 `/items?item=<id>`로 이동해 그 아이템의 분류 탭과 상세 패널이 열립니다. `ItemMisc`(못, 미스릴 같은 기초 재료 62종)를 빼먹었을 때는 재료 2개 중 1개만 연결되는 문제가 있었는데, 추가하고 나서 영웅 등급 이상 무기/방어구 488종 전부 재료 2개가 정확히 채워지는 것까지 확인했습니다.

**제작법(조합 트리)**: 상세 패널의 "조합법"에 `재료 + 재료 = 아이템` 한 줄과 함께, 재료가 피라미드 형태로 몇 단계든(관찰상 최대 4단계) 내려가며 전부 보입니다 — `backend/src/routes/items.ts`의 `GET /items/:id`가 `materials`를 4단계 중첩(`include`)으로 가져오고, `frontend/src/components/RecipeTree.tsx`가 이를 재귀적으로 렌더링합니다. dak.gg에서 정확히 이 형태의 조합 트리 페이지를 찾지는 못해서(있는 건 능력치 툴팁과 빌드 순서 아이콘 정도), 같은 카드/아이콘 시각 언어로 직접 구성했습니다. "상위 조합 아이템"(이 재료로 무엇을 만들 수 있는지)은 한 단계만 보여줍니다 — 위로 올라가는 방향은 한 아이템이 수십 개의 상위 아이템에 쓰이기도 해서 재귀시키면 폭발적으로 커집니다.

**루트**: 플레이어가 게임 안에서 공유한 빌드 루트(실험체·무기·목표 아이템·이동 지역 순서·특성·전술 스킬·스킬 순서)를 `/v1/weaponRoutes/recommend`에서 가져옵니다. API는 한 페이지에 100개씩 `next` 커서로만 넘길 수 있고 정렬·필터가 없어서, `scripts/importRoutes.ts`(`er:routes`)가 전체를 DB에 넣고 비공개(`share: false`) 루트는 제외합니다. 화면은 우리 API에서 10개씩 페이지 단위로 그때그때 불러옵니다(`GET /api/routes?page=&pageSize=`, 응답 `{ routes, total, page, pageSize }`). 지역 코드는 `Area` 테이블 → `Area/Name/*`로 한국어 이름을 찾아 저장하고, 특성·전술 스킬은 코드로 저장해서 `Trait` / `TacticalSkill` 테이블(`er:import`)과 연결합니다. 특성은 `[코어, 메인 서브×2, 보조 서브×2]` 순서이며, 상세 화면은 dak.gg처럼 메인 그룹(코어 4개 + 서브 8개)과 보조 그룹(서브 8개)의 선택지를 모두 보여주고 고른 것만 강조합니다. 스킬 순서는 레벨 1~20의 키(Q/W/E/R/T)를 빈 칸까지 그대로 저장해서 레벨이 밀리지 않게 합니다. 후반 아이템은 `lateGameItemCodes`(`{"0":[...],"1":[...]}` 형태의 세트 목록, `999999`는 빈 칸)를 세트 순서대로, 원격 드론 구매는 `remoteTransferItemCodes`를 저장해 보여줍니다. 무기 코드는 `WeaponTypeInfo` 행 순서와 달라서 공식 문서의 숙련도 코드표를 그대로 옮긴 매핑을 씁니다. 공식 문서와 실제 응답이 다른 부분도 있습니다 — 래퍼 키가 문서의 `recommendedWeaponRoute`가 아니라 `recommendWeaponRoute`이고, `routeId` 파라미터는 무시됩니다.

루트 상세의 **필요 재료**는 목표 아이템 5개를 조합법으로 끝까지 풀어 기초 재료와 개수를 구하고(`GET /api/routes/:id`의 `materials`), 각 재료를 루트 이동 지역 중 처음 구할 수 있는 곳에 묶어 보여줍니다("공장에서: 배터리, 고철 …"). 경로 지역에서 나오지 않는 재료는 "경로 밖에서"로 따로 모아 나오는 지역이나 야생동물을 함께 적습니다. 시작 무기처럼 게임이 주는 아이템은 고려하지 않습니다.

루트 화면은 실험체별로 나눠 볼 수 있고(`/routes?character=<id>`, 사이드바 목록은 `GET /api/routes/characters`), 무기 종류(`?weapon=`, 목록은 `GET /api/routes/weapons?characterId=`)와 제목 검색(`?q=`, Enter로 적용)으로 더 좁힐 수 있으며, `GET /api/routes?sort=`로 4가지 정렬을 지원합니다.
- `popular`(많이 사용된 순): API의 사용 횟수 필드(`count`)는 항상 0이라, 추천 수(`v2Like`)를 기준으로 씁니다.
- `winRate`(승률 높은 순): 승률에는 표본 크기가 없어서 추천 1~3개짜리 루트가 100%로 뜨곤 합니다. 추천 10개 미만 루트는 뒤쪽으로 보냅니다(`MIN_LIKES_FOR_WIN_RATE`).
- `newest` / `oldest`: 루트 공유(수정) 시각(`updateDtm`) 기준 내림/올림차순.

**알려진 한계**
- 장비의 고유 효과(예: "예열 - 증강")는 표시하지 않습니다. 효과 문구는 l10n `Item/Skills/*`에 있지만, 어떤 장비에 어떤 효과가 붙는지와 `{0}` 자리의 수치는 공식 API 어디에도 없습니다.
- 전술 스킬 그룹 120은 로컬라이제이션에 이름이 없어서 "정보 없음"으로 표시됩니다. 일부 전술 스킬(7종)과 아이템(크레딧·현상금 등 22종)은 팬키트에 아이콘이 없어 글자로 표시됩니다.
- 맵·야생동물은 다루지 않습니다. 공식 API에 맵 데이터와 야생동물 스폰 위치가 없어서, 정확한 정보를 제공할 수 없는 기능은 범위에서 제외했습니다.
- 공식 API는 문서화된 rate limit이 없고 429가 자주 떠서, `erApiClient.ts`에 지수 백오프 재시도가 들어가 있습니다.

관련 코드: `backend/src/services/erApiClient.ts`(API 클라이언트, 재시도 포함) · `backend/scripts/fetchErData.ts`(원본 응답을 `backend/data/raw/*.json`으로 덤프하는 진단용 스크립트) · `backend/scripts/importErData.ts`(실제 DB에 upsert하는 스크립트).

## 이미지

공식 API에는 이미지가 전혀 없습니다. 이터널 리턴 팬키트(공개 Google Drive)에서 가져오며, 폴더 목록은 팬키트 포털 [drive-portal-bice.vercel.app](https://drive-portal-bice.vercel.app)의 파일 목록 API(`/api/files?folderId=`)로 읽습니다. `backend/scripts/importFankitImages.ts`(`er:images`)가 처리합니다.

- `01. Character/{번호}. {영문명}/` — 폴더 번호는 실험체 코드와 일부 어긋나므로(예: `003. Hyunwoo`인데 현우의 코드는 7) **영문명으로 매칭**합니다. 대소문자·악센트(`István`)는 무시하며, NPC 폴더는 맞는 실험체가 없어 건너뜁니다.
- 프로필: `02. Default/*_Mini_00.png` → `Character.imageUrl`
- 전신(기본 스킨): `02. Default/*_Full_00.png` → `Character.fullImageUrl` + `Skin`(기본 스킨)
- 스킨: `06.`~`98.` 폴더의 `*Full*` 이미지 → `Skin`. 폴더 이름(예: `ExecutionER Jackie`)을 공식 `CharacterSkin` 테이블의 영문 이름과 대소문자·기호 무시하고 맞춰서, 한국어 스킨 이름(`Skin/Name/{코드}`, 예: "처형자 재키")을 붙입니다.
- 스킬 아이콘: `03. Skill Icon/` 파일 이름의 `P`/`T`/`Passive`·`Q`·`W`·`E`·`R` → `Skill.imageUrl`. 이름 규칙이 실험체마다 달라서(`Jackie_Q1`, `01. P`, `Cathy_T`, `Yuki_Passive` 등) 느슨하게 매칭합니다.

- 아이템·특성·전술 스킬 아이콘: `02. Ingame_Image/`의 파일 이름(영문)을 공식 l10n 영문 이름(`Item/Name`, `Trait/Name`, `Skill/Group/Name`)과 맞춥니다. 특성 그룹 아이콘은 `07. Loadout/01. Havoc/Havoc1.png` 같은 파일입니다. 팬키트 파일 이름의 오타(`Miltary Suit`, `Shapened Spear` 등)는 편집 거리 1~2 이내에서 가장 가까운 하나만 허용하고, 6등급 변형(`-진홍`/`-새벽`)과 `Lv2` 아이템은 기본 아이템 아이콘을 씁니다.

파일을 레포에 넣지 않고 DB에는 `/api/images/{fileId}?w={폭}`(프로필 256px, 전신 1000px, 아이콘 128px)을 저장합니다. 구글이 다른 사이트에서 삽입한 Drive 이미지를 429로 막아서, 백엔드(`src/routes/images.ts`)가 대신 받아 `backend/data/images`에 캐시해 둡니다. `er:import`는 스킬을 다시 만들 때 기존 아이콘 URL을 유지합니다.

**한계**: 팬키트 Drive와 포털이 공개 상태로 유지된다는 전제에 기대고 있습니다. 둘 중 하나가 닫히면 `er:images`가 실패하고 이미 저장된 링크도 깨질 수 있습니다.

## 빌드

```bash
npm run build   # backend(tsc) + frontend(vite build)
```
