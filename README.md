# 🤖 Autonomous AI Minecraft Bot

OpenAI GPT 기반의 **완전 자율** 마인크래프트 봇입니다. 사전 정의된 목표를 기반으로 능동적으로 행동하며, 플레이어의 대화에도 즉각 반응합니다.

## 🎯 특징

- **완전 자율**: 설정 가능한 주기로 상황을 판단하고 다음 행동을 결정
- **목표 지향**: 생존, 자원 수집, 건설, 탐험 등의 목표 추구
- **대화형**: 플레이어 메시지에 실시간 반응 및 응답
- **명령어 기반**: LLM이 간단한 명령어 문법으로 행동 지시
- **OpenAI GPT**: GPT-4 또는 GPT-3.5-turbo 사용
- **실패 학습**: 과거 실패를 기억하고 같은 실수를 반복하지 않음
- **커스텀 성격**: 봇의 말투와 성향을 자유롭게 설정 가능
- **자동 도구 제작**: 필요한 도구를 자동으로 제작하고 장착
- **타임아웃 관리**: 멈추지 않고 항상 자율 모드로 복귀

## 📐 아키텍처

```
                    ┌──────────────────┐
                    │   LLM (OpenAI)   │
                    │                  │
                    │  - Perceive      │
                    │  - Think         │
                    │  - Decide        │
                    └────────┬─────────┘
                             │
                       Command String
                        (e.g., "mine 100 64 200")
                             │
                    ┌────────▼─────────┐
                    │ Command Parser   │
                    └────────┬─────────┘
                             │
                       Parsed Command
                             │
                    ┌────────▼─────────┐
                    │ Action Executor  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Minecraft Bot  │
                    │  (Mineflayer)    │
                    └──────────────────┘
```

## 🎮 LLM 명령어 문법

LLM은 다음과 같은 간단한 명령어를 리턴합니다:

### 이동 & 시야
- `move <x> <y> <z>` - 특정 좌표로 이동
- `look entity <name>` - 엔티티 바라보기
- `look player <name>` - 플레이어 바라보기
- `look position <x> <y> <z>` - 좌표 바라보기

### 전투 & 채집
- `attack <target>` - 공격 (target: 엔티티 이름 또는 "nearest")
- `mine <x> <y> <z>` - 블록 채굴

### 건설 & 제작
- `place <block> <x> <y> <z>` - 블록 설치
- `craft <item> [count]` - 아이템 제작

### 인벤토리 & 생존
- `equip <item> [destination]` - 아이템 장착
- `eat` - 음식 먹기

### 소셜 & 기타
- `chat <message>` - 채팅 메시지 전송
- `follow <player>` - 플레이어 따라가기
- `stop_follow` - 따라가기 중지
- `toss <item> [count] [player]` - 아이템 주기/버리기
- `wait [milliseconds]` - 대기

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 수정 (필수!)
nano .env
```

```env
# OpenAI API 키 (필수!)
LLM_API_KEY=sk-...your-key-here

# 모델 선택
LLM_MODEL=gpt-4

# 마인크래프트 서버
MINECRAFT_HOST=your-server-ip
BOT_USERNAME=AIBot
```

### 2. OpenAI API 키 발급

1. https://platform.openai.com/api-keys 접속
2. "Create new secret key" 클릭
3. 생성된 키를 `.env` 파일의 `LLM_API_KEY`에 입력

### 3. 봇 실행

```bash
# 개발 모드 (권장)
npm run dev

# 프로덕션 모드
npm run build
npm run start
```

### 4. 웹 뷰어로 봇 시야 확인

봇이 실행되면 자동으로 두 개의 웹 뷰어가 시작됩니다:

- **3인칭 시점**: http://localhost:3000
- **1인칭 시점**: http://localhost:3001

브라우저에서 해당 URL에 접속하면 봇이 보는 마인크래프트 월드를 실시간으로 확인할 수 있습니다.

## 🧠 LLM 의사결정 과정

### 봇의 Primary Goals

1. **생존 (Survive)**
   - 체력과 배고픔 유지
   - 위험 회피 (적대 몹, 낙하)

2. **자원 수집 (Gather Resources)**
   - 귀중한 광석 채굴 (다이아몬드, 철, 석탄)
   - 나무, 돌 수집

3. **건설 & 제작 (Build and Craft)**
   - 도구 제작
   - 보호소 건설

4. **탐험 (Explore)**
   - 새 지역 발견
   - 마을, 자원 찾기

5. **상호작용 (Interact)**
   - 플레이어 메시지에 응답
   - 지시 따르기

### 의사결정 우선순위

```
긴급 상황 (체력 < 10, 배고픔 < 10)
    ↓
플레이어 명령
    ↓
능동적 목표 (자원 수집, 탐험 등)
```

## 📊 Perception 데이터

LLM에게 제공되는 환경 정보:

### STATUS
- 위치 (x, y, z)
- 체력 / 배고픔 / 경험치
- 경고 (낮은 체력, 낮은 배고픔, 밤 시간)

### NEARBY RESOURCES
- 주변 32블록 내 중요 블록
- 블록 타입, 개수, 가장 가까운 거리
- 우선순위: 광석 > 유틸리티 > 자원

### ENTITIES
- ⚠️ 적대 몹 (위험!)
- 주변 플레이어
- 중립 몹

### INVENTORY
- 보유 아이템 및 수량
- 중요 아이템 우선 표시

### RECENT CHAT
- 최근 3개 채팅 메시지

## 💬 플레이어 상호작용 예시

```
[Player] Hello bot!
[AIBot] chat Hello! I'm currently gathering resources. Need anything?

[Player] Follow me to the mine
[AIBot] follow PlayerName

[Player] Mine that iron ore
[AIBot] mine 145 63 -89

[Player] Are you hungry?
[AIBot] eat
[AIBot] chat Thanks for asking! Just ate some food.

[Player] Stop following me
[AIBot] stop_follow
[AIBot] chat Okay, I'll continue exploring on my own!
```

## ⚙️ 설정 커스터마이징

### LLM 파라미터 조정

`.env` 파일에서:

```env
# 모델 선택
LLM_MODEL=gpt-4          # 더 똑똑함, 더 비쌈
# LLM_MODEL=gpt-3.5-turbo  # 빠르고 저렴

# Temperature (창의성)
LLM_TEMPERATURE=0.7      # 0.0 (결정론적) ~ 1.0 (창의적)

# Max tokens (응답 길이)
LLM_MAX_TOKENS=512       # 명령어 하나만 리턴하므로 낮게 설정
```

### 자율 행동 주기 조정

`src/ai-bot.ts:19`에서:

```typescript
private AUTONOMOUS_TICK_RATE = 5000 // 5초마다 결정 (밀리초)
```

- 더 짧게: 더 반응적, LLM API 비용 증가
- 더 길게: 느린 반응, 비용 절감

### Primary Goals 수정

`src/llm-agent-v2.ts:112-117`에서 목표를 수정할 수 있습니다:

```typescript
## Primary Goals
1. **Survive**: ...
2. **Gather Resources**: ...
// 새 목표 추가 가능
```

## 🛠️ 새로운 명령어 추가하기

### 1. 명령어 타입 정의

`src/commands.ts`에 추가:

```typescript
export interface NewCommand {
  type: 'new_command'
  parameter: string
}

export type Command =
  | MoveCommand
  | ...
  | NewCommand  // 추가
```

### 2. 파서 구현

`src/command-parser.ts`에 추가:

```typescript
case 'new_command':
  return this.parseNewCommand(parts)
```

### 3. 실행 로직 구현

`src/action-executor.ts`에 추가:

```typescript
case 'new_command':
  return await this.executeNewCommand(command)
```

### 4. LLM 프롬프트 업데이트

`src/commands.ts`의 `COMMAND_GRAMMAR`에 설명 추가

## ⚡ 성능 최적화

### LLM 응답 속도 개선

봇의 반응 속도가 느리다면 다음 설정을 조정하세요:

#### 1. 빠른 모델 사용 (권장)
`.env` 파일에서:
```env
LLM_MODEL=gpt-3.5-turbo  # GPT-4 대비 10배 빠르고 저렴
```

#### 2. Tick Rate 조정
자율 행동 주기를 조정하세요:
```env
AUTONOMOUS_TICK_RATE=3000  # 3초 (기본값, 빠른 반응)
# AUTONOMOUS_TICK_RATE=5000  # 5초 (균형)
# AUTONOMOUS_TICK_RATE=8000  # 8초 (비용 절감)
```

#### 3. Max Tokens 제한
```env
LLM_MAX_TOKENS=512  # 명령어 하나만 리턴하므로 낮게 설정
```

### 권장 설정

**빠른 반응 (gpt-3.5-turbo)**
- Tick Rate: 3초
- Max Tokens: 512
- 시간당 비용: ~$1-2

**균형 (gpt-3.5-turbo)**
- Tick Rate: 5초
- Max Tokens: 512
- 시간당 비용: ~$0.5-1

## 📈 비용 관리

### OpenAI API 비용 예상

- **GPT-4**: ~$0.03 per 1K tokens
  - 5초 주기: 약 720 calls/hour
  - Input ~500 tokens, Output ~50 tokens
  - **시간당 약 $20-30**

- **GPT-3.5-turbo**: ~$0.002 per 1K tokens
  - 5초 주기: 약 720 calls/hour
  - **시간당 약 $1-2**

### 비용 절감 팁

1. **GPT-3.5-turbo 사용**: 대부분 충분한 성능
2. **Tick rate 증가**: 10초 또는 15초로 설정
3. **Context 최소화**: perception에서 불필요한 정보 제거
4. **Max tokens 제한**: 512 이하로 설정

## 🤖 커스텀 성격 시스템

봇의 말투와 성향을 자유롭게 커스터마이징할 수 있습니다!

### 사용 방법

`.env` 파일에서 `BOT_PERSONALITY` 설정:

```env
BOT_PERSONALITY="- Speak like a pirate\n- Call ores 'treasure'\n- Use 'Arrr!' frequently"
```

### 예시

**해적 광부:**
```env
BOT_PERSONALITY="- Speak like a pirate\n- Call ores 'treasure'\n- Use 'Arrr!', 'Ahoy!', 'matey'\n- Example: 'Arrr! I'll be plunderin' that iron for ye, matey!'"
```

**친근한 도우미:**
```env
BOT_PERSONALITY="- Very friendly and enthusiastic\n- Use warm, casual language\n- Celebrate with emojis\n- Example: 'Hey there! I'd love to help! 😊'"
```

**조용한 전문가:**
```env
BOT_PERSONALITY="- Extremely quiet\n- Only speak when necessary\n- Brief responses only\n- Example: 'OK.' or just '✓'"
```

더 많은 예시는 `personality-examples.md` 파일을 참고하세요!

## 🧠 실패 학습 시스템

봇은 과거 실패를 기억하고 같은 실수를 반복하지 않습니다.

### 작동 방식

1. **실패 감지**: 명령 실행 실패 시 자동 기록
2. **LLM에 전달**: 최근 5개의 실패 로그를 context에 포함
3. **학습 및 적응**: LLM이 실패를 분석하고 대안 찾기

### 예시

```
[Bot tries to mine diamond_ore]
⚠️ No diamond_ore found nearby

[Next tick - Bot receives failure log]
⚠️ RECENT FAILURES:
  [2s ago] mine failed: mine diamond_ore failed

[Bot decides alternative]
→ Mining iron_ore instead (changed strategy)
```

### 학습 패턴

- 같은 블록 채굴 실패 → 다른 자원으로 전환
- 도구 없이 채굴 실패 → 먼저 도구 제작
- 제작 실패 → 필요한 재료 먼저 수집
- 플레이어 따라가기 실패 → 다른 작업으로 전환

## 🔧 자동 도구 제작

봇이 채굴 작업 전에 필요한 도구를 자동으로 제작하고 장착합니다.

### 지원 기능

- **도구 요구사항 판단**: 블록 타입에 따라 필요한 곡괭이 자동 파악
- **자동 제작**: 인벤토리 재료로 최적의 도구 제작
- **자동 장착**: 제작한 도구를 즉시 장착
- **크래프팅 테이블 관리**: 필요 시 테이블도 자동 제작

### 도구 요구사항

- 돌/코블스톤: 나무 곡괭이 이상
- 철 광석: 돌 곡괭이 이상
- 금/다이아몬드 광석: 철 곡괭이 이상
- 흑요석: 다이아몬드 곡괭이 필수

## 🐛 트러블슈팅

### API 키 오류
```
❌ ERROR: LLM_API_KEY not set!
```
→ `.env` 파일에 올바른 OpenAI API 키 설정

### 명령어 파싱 실패
```
⚠️  Failed to parse command: ...
```
→ LLM이 잘못된 형식으로 응답. Temperature 낮추거나 프롬프트 개선

### 봇이 움직이지 않음
```
⏭️  Skipping tick (still processing)
```
→ 이전 명령이 아직 실행 중. 정상 동작

### 비용이 너무 높음
→ GPT-3.5-turbo로 변경하거나 tick rate 증가

### LLM 입력/출력 확인하기

봇의 의사결정 과정을 디버깅하려면:

```env
# .env 파일에 추가
LLM_DEBUG=true
```

이렇게 하면 LLM에 전달되는 전체 시스템 프롬프트와 사용자 입력을 볼 수 있습니다:

```
[LLMAgent] ============ LLM INPUT ============
[LLMAgent] System Prompt:
You are an AI agent controlling a Minecraft bot...
[LLMAgent] ---
[LLMAgent] User Prompt:
Current Situation:
STATUS:
Position: (100, 64, 200)
Health: 20.0/20 | Food: 20/20 | Level: 0
...
[LLMAgent] ====================================
[LLMAgent] ============ LLM OUTPUT ===========
[LLMAgent] Response: mine iron_ore 3
[LLMAgent] ======================================
```

## 📊 성능 모니터링

로그에서 확인:

```
[AIBot] 🧠 Autonomous tick...
[LLMAgent] Getting next action from LLM...
[LLMAgent] ============ LLM INPUT ============
[LLMAgent] System Prompt Length: 1450 chars
[LLMAgent] User Prompt:
Current Situation:
STATUS:
Position: (100, 64, 200)
Health: 20.0/20 | Food: 20/20 | Level: 0
...
[LLMAgent] ====================================
[LLMAgent] ============ LLM OUTPUT ===========
[LLMAgent] Response: mine iron_ore 3
[LLMAgent] ======================================
[CommandParser] Parsing: mine iron_ore 3
[ActionExecutor] Executing: mine
[ActionExecutor] Mining 3x iron_ore
[ActionExecutor] Mined iron_ore (1/3)
[ActionExecutor] Mined iron_ore (2/3)
[ActionExecutor] Mined iron_ore (3/3)
[ActionExecutor] Finished mining iron_ore: 3/3
```

## 🔗 기타 스크립트

```bash
# 단순 봇 (LLM 없음)
npm run dev              # TypeScript 버전
npm run start:legacy     # JavaScript 버전

# 기존 Goal 기반 AI 봇 (V1)
npm run dev:ai
npm run start:ai
```

## 📜 라이선스

ISC

## 🙏 기여

이슈와 PR을 환영합니다!

---

**Happy Botting! 🤖⛏️**
