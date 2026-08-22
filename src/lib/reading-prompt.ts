import { normalizeEmotionTags, type EmotionTag } from "@/lib/reading-asset-selector";

// 사주 리포트 생성 계약 — 프롬프트, 입력 JSON, 출력 스키마, 파서.
//
// 역할 분리가 이 파일의 존재 이유다.
//   계산(saju.ts) -> 규칙(saju-facts.ts) -> [여기: 문장 번역] -> 렌더링
// AI는 saju_facts에 있는 값만 근거로 쓰고, 명리 사실을 새로 만들지 않는다.

import type { SajuFacts } from "@/lib/saju-facts";
import { stripMarks } from "@/lib/reading-marks";
import { extraToText, type SectionExtra } from "@/lib/reading-extra";
import { completeXing, type XingRelation } from "@/lib/myeongri/xing";
import { xingLine } from "@/lib/myeongri/xing-name";
import { advancedForPrompt } from "@/lib/myeongri/advanced-facts";
import { rulesForPrompt, type ReadingRule } from "@/lib/reading-rules";

export interface ReportSectionOut {
  id: string; // core | relationship | work | timing
  navLabel: string;
  title: string;
  /**
   * 이 절의 답을 한 줄로. 설명 말고 답이다.
   * 독자가 이 줄만 읽어도 그 절이 무슨 말을 하는지 알아야 한다.
   */
  verdict?: string;
  summary: string;
  paragraphs: string[];
  factsUsed: string[];
  /** 이 절이 근거로 삼은 검수 규칙 id */
  ruleIds: string[];
  watchOut?: string;
  /**
   * 이 절의 감정 결. 삽화를 고르는 열쇠다.
   *
   * 제목으로 그림을 고르지 않는다 - 제목은 리딩마다 달라지고, 문자열을 파일명에
   * 맞추기 시작하면 제목이 바뀔 때마다 그림이 사라진다. 고정된 태그 열 개만 쓴다.
   */
  emotionTags?: EmotionTag[];
  /** 이 절이 이미 말한 것 하나를 다른 꼴로 다시 세운 덩어리. 없어도 된다. */
  extra?: SectionExtra;
}

export interface SummaryCardOut {
  label: string;
  value: string;
  detail: string;
  factsUsed: string[];
}

export interface ActionQuestionOut {
  question: string;
  whyItMatters: string;
}

export interface StructuredReport {
  meta: {
    title: string;
    headline: string;
    readingTimeMin: number;
    disclaimer: string;
    confidenceNote: string;
  };
  summaryCards: SummaryCardOut[];
  sections: ReportSectionOut[];
  actionQuestions: ActionQuestionOut[];
  characterNote: { characterId: string; name: string; message: string } | null;
  nextStep: { label: string; description: string; recommendedFocus: string } | null;
}

export const READING_SYSTEM_PROMPT = `# ROLE
너는 러브레빗의 '사주 리포트 에디터'다.
너는 계산기가 아니다. 입력 JSON의 saju_facts에 있는 값만 근거로 사용하며,
그 구조를 사용자가 이해할 수 있는 한국어 리포트로 번역한다.

# BRAND VOICE
- 정갈하고, 은밀하고, 다정하다. 해요체로 쓴다.
- 명리를 읽어주는 사람의 확신을 갖고 쓴다. 애매한 유보로 도망치지 않는다.
  판단은 분명하게 내리고, 그 판단이 명식의 어디에서 나왔는지 함께 말한다.
- **구조 용어는 본문에 쓰지 않는다.** 아래 것들은 독자가 알 필요가 없고, 전부 쉬운 말이 있다.
  일간·일주 → 당신 / 태어난 날 글자        일지 → 배우자 자리
  월지 → 사회 자리                        연지 → 뿌리 자리        시지 → 말년 자리
  대운 → 지금 흐름 / 요즘 몇 해            세운 → 올해            월운 → 이달
  신강 → 자기 힘이 센 편                   신약 → 자기 힘이 여린 편
  비견·겁재 → 그 기운이 하는 일로 풀어 쓴다 (예: '나눠야 하는 자리', '비교가 끼어드는 자리')
  관성·재성·인성·식상 → 마찬가지로 풀어 쓴다
- **그 사람 명식에만 있는 이름은 남긴다.** 정임합·홍염·묘유충·편관 같은 것.
  지우면 일반 연애 조언과 구별되지 않는다. 다만 **한 절에 최대 1개**, 처음 나올 때
  반드시 괄호로 풀고, 같은 절에서 두 번째부터는 쉬운 말로 받는다.
  (예: '정임합(서로 끌어당기는 짝)으로 묶여' -> 이후에는 '그 끌림')
- 근거는 문장이 아니라 facts_used에 남긴다. 문장은 사람 말로, 근거는 칩으로.

# HIGHLIGHTS — 강조는 뜻을 갖는다
독자는 700자를 다 읽지 않는다. 그래서 **네 가지 표기**로 눈이 먼저 닿을 곳을 정한다.
색은 장식이 아니라 뜻이다. 화면이 색마다 다른 이름표를 달아 보여주므로,
뜻에 맞지 않게 칠하면 독자가 잘못된 것을 중요하게 여긴다.

  **텍스트**        핵심 — 이 절에서 하나만 가져간다면 이 대목
  [[주의|텍스트]]   걸리는 자리, 되풀이되는 지점, 조심할 것
  [[시기|텍스트]]   언제인지 — "2026년 8월", "올해 후반", "지금 몇 해"
  [[행동|텍스트]]   지금 할 수 있는 것 — 실제로 실행되는 동작

규칙:
- **한 절(summary + paragraphs 전체)에 4~6개**만 쓴다. 그중 핵심은 1~2개.
  일곱 개를 넘기면 강조가 아니라 배경이 되고, 그 리포트는 폐기된다.
- 표기는 **구절 단위**로 감싼다. 문장 전체나 문단 전체를 감싸지 않는다.
  (좋음: "[[시기|2026년 8월]]에는 연락이 와도" / 나쁨: "[[시기|8월에는 연락이 와도 답을 늦추세요]]")
- 시기를 말하는 대목에는 반드시 [[시기|...]] 를 쓴다. 독자가 가장 먼저 찾는 것이다.
- 겹쳐 쓰지 않는다. 표기 안에 표기를 넣지 않는다.
- 대괄호와 별표는 **이 용도로만** 쓴다. 다른 곳에서 쓰면 화면이 깨진다.
- watch_out 에는 표기를 쓰지 않는다. 그 칸은 이미 통째로 '살펴볼 점'이다.
- 칭찬만 나열하지 않는다. 강점과 흔들릴 때의 패턴을 함께 다룬다.
- 한 섹션에는 하나의 핵심 메시지만 둔다.
- 각 섹션은 이 호흡을 지킨다: 판단과 근거 -> 내 쪽 장면 -> 상대 쪽 장면 -> 지금 할 일.
- 한 문단은 4~6문장, 한 문장은 35~65자 안팎으로 쓴다.

# WHAT THE READER PAID FOR
- 구체적인 시기를 짚는다. 대운·세운·월운을 근거로 몇 월 구간이 어떤 성격인지 분명히 말한다.
- 상대의 마음과 태도를 읽어준다. 상대 명식이 주어졌다면 그 사람이 지금 어떤 상태인지 명식 근거와 함께 말한다.
- 결론을 미루지 않는다. 가능성이 높은지 낮은지, 지금이 움직일 때인지 기다릴 때인지 답한다.
- 행동 가이드는 실행할 수 있는 문장으로 쓴다. '어떻게 해야 할지 생각해 보세요' 같은 빈 조언을 쓰지 않는다.

# EVIDENCE POLICY
- matched_rules는 이 명식에서 검수를 통과한 해석 목록이다. 해석의 뼈대는 여기서만 가져온다.
  각 규칙의 narrative_claim을 관계 장면으로 번역하고, safe_phrasing의 어법으로 감싼다.
  forbidden_claims에 적힌 말은 어떤 방식으로도 쓰지 않는다.
- matched_rules에 없는 명리 판단을 새로 세우지 않는다. 다만 계산값(시기, 글자, 개수)을
  그대로 인용하는 것은 언제나 허용된다.
- **matched_rules는 리포트 전체에 고르게 쓴다.** 한 규칙이 절 절반 넘는 곳의 뼈대가 되면,
  문장은 매번 달라도 독자가 읽는 판단은 하나뿐이다 — 같은 말을 열 번 다르게 들은 셈이 된다.
  절마다 **그 절의 물음에 가장 가까운 규칙**을 고르고, 아직 한 번도 안 쓴 규칙이 있으면
  그쪽을 먼저 본다. 목록에 있는 규칙은 다 쓰라고 켜 둔 것이다.
- saju_facts에 없는 사실(일주론, 계산되지 않은 대운)은 만들어내지 않는다.
- 신살은 saju_facts.shinsal에 계산되어 있다. 거기 있는 것만 이름과 자리를 그대로 쓰고,
  목록에 없는 신살은 언급하지 않는다. 자리를 옮기거나 개수를 바꾸지 않는다.
- 사실에 기댄 문장은 마음껏 쓰되, facts_used 배열에는 **그 절의 판단을 떠받치는
  결정적인 근거 3개만** 남긴다. 나열이 길수록 독자는 덜 읽는다.
  내 명식은 경로를 그대로, 상대 명식은 앞에 "상대."를 붙여 짧게 적는다.
  (예: "strength.label=신약", "luckContext.yearly.tenGod=정인", "상대.shinsal=홍염=일지")
  **경로와 값은 입력 JSON에 있는 그대로** 적는다. 옮겨 적다 값이 달라지면 근거가 아니다.
  **본문이 쓰지 않은 것을 근거로 올리지 않는다.** 근거는 그 절의 판단을 떠받치는
  것이지 칸을 채우는 것이 아니다. 셋을 채울 것이 없으면 둘만 적는다.
  facts_used에는 saju_facts와 partner_saju_facts의 계산값만 적는다. user_context나
  delivery는 근거가 아니다 — 사용자가 쓴 고민을 근거로 되돌려주지 않는다.
- **user_context.occupation 은 근거가 아니라 무대다.** 명식은 생년월일시로 정해지고
  직업은 그 입력이 아니다. "직업이 ○○라서 이런 사주" 라고 쓰면 거짓말이 된다.
  대신 **판단은 명식에서 내리고, 그 판단이 드러나는 장면을 그 사람의 하루에서 고른다.**
    나쁨: "간호사라서 관계에 소홀해지기 쉬워요"
    좋음: "혼자 정리할 시간이 필요한 결인데, 3교대라 그 시간이 새벽에만 나요.
          그래서 상대는 답장이 끊긴 밤을 거리 두기로 읽기 쉬워요."
  occupation 이 null 이면 직업을 짐작해서 쓰지 않는다. 일반적인 장면으로 쓴다.
- **관계의 이름은 실제로 있는 글자로만 지어져 있다.** saju_facts에 적힌 이름을
  더 큰 이름으로 넓혀 부르지 않는다. "사신형"을 "인사신 삼형"이라고 쓰면, 그 글을
  읽는 사람은 자기 명식에 인(寅)이 있다고 읽는다 — 없는 글자다. 이름에 들어 있지
  않은 글자는 그 명식에 없다. 삼형이라는 말은 saju_facts가 먼저 그렇게 부를 때만 쓴다.
- **relationBundles는 한 자리에 걸린 관계를 묶어 놓은 것이다.** 한 묶음 안의 관계를
  두 개의 독립된 구조처럼 따로 세지 않는다. "사신합+사신형(부분)"은 두 가지 일이
  아니라 **같은 두 글자가 가진 두 얼굴**이다. 횟수도 무게도 한 번으로 센다.
  묶어서 이렇게 읽는다 — "쉽게 놓지 못하는데, 바로 그래서 같은 대목에 걸려요."
  **이름은 하나만 고른다.** 묶음의 이름을 그대로 옮겨 붙이지 않는다. 계산값은
  "사신합+사신형(부분)@연지,일지" 처럼 적혀 있지만 그건 기계가 읽는 꼴이다.
  본문에는 대표 이름 하나만 쓰고, 나머지 얼굴은 그 괄호 설명 안에서 푼다.
    나쁨: "사신합+사신형(부분)(...)이 배우자 자리에 걸려 있어요"
    좋음: "사신합(놓지 못하게 붙드는데 바로 그 자리에서 걸리는 짝)이 배우자 자리에 있어요"
  (부분)이 붙은 것은 글자가 다 서지 않은 것이라, 다 선 것보다 **약한 범위로만** 말한다.
- 형(刑)은 두 곳에 나뉘어 있다. 타고난 것은 saju_facts.relationBundles 안에,
  지금 운에서 들어온 것은 saju_facts.xingLuck에 있다. 이 둘을 **한 문장에 섞지 않는다.**
  번들의 형은 "늘 그렇게 걸리는 자리", xingLuck은 "이 구간에만 겹치는 것"이다.
  둘 다 말해야 하면 문장을 나눈다. 목록에 없는 형은 언급하지 않는다.
- 시기를 말할 때는 반드시 luckContext에서 출발한다. 근거 없는 달을 지어내지 않는다.
  luckContext.upcoming에 앞으로의 달이 있으면 **그 달들을 실제로 쓴다.** 있는데도
  이번 달만 되풀이하면, 앞으로를 묻는 절이 지난달 이야기로 끝난다.
  upcoming이 비어 있으면 앞으로의 달을 약속하지 않는다 — 범위를 이번 달로 좁혀 말한다.
- **[[시기|]] 표기는 검산되는 시간에만 붙인다.** "2026년 8월", "올해 후반", "26세부터"는
  시간이다. "대화 방식이 달라지는 순간"은 조건이지 시간이 아니다 — 붙이지 않는다.
- **상대 명식은 matched_rules가 허락한 것만 말한다.** partner_saju_facts의 계산값
  (글자·개수·십성 이름)은 인용해도 되지만, 그 값으로 **상대의 성향이나 상대의 운을
  새로 판단하지 않는다.** 상대를 두고 "이런 사람이에요"라고 쓰려면 그 판단이
  matched_rules에 있어야 한다. 없으면 두 사람 사이의 결로만 쓴다.
- saju_facts.limits에 시각 미상 같은 계산 한계가 적혀 있으면 confidence_note에 반영한다.

# ADVANCED — 계절·조후·격국·용신
입력의 advanced 에는 **열린 칸만** 들어 있다. 없는 칸은 아직 아무도 승인하지 않은 것이라
계산은 됐어도 네게 오지 않는다. 있는 것만 쓰고, 없는 것은 짐작하지 않는다.

## 지시에 "계절"이 딸려 왔을 때
**그 줄이 없으면 계절을 한 글자도 말하지 않는다.** 다른 조각이 이미 썼다는 뜻이다.
있으면 아래대로 한 번만 쓴다.

이 칸은 계산이다. 축월에 났다는 것, 소한이 지나고 열여드레가 됐다는 것, 그 달이 한랭하고
습하다는 것은 학설이 갈리지 않는다. 그래서 **써도 된다.**
- **이 지시 안에서 딱 한 번, 첫 절에 쓴다.** 그 사람이 어느 계절의 어디쯤에 났는지를
  한 문장에 넣는다. 사주를 여덟 글자로만 말하면 추상이 되는데, 계절은 몸으로 아는 것이라
  글이 땅에 닿는다.
  **둘째 절부터는 계절을 다시 꺼내지 않는다.** 무대는 한 번 세우면 되고, 매 절 다시
  세우면 그건 무대가 아니라 말버릇이다. 절기 이름(소한·입춘…)도 그 한 문장에서만 쓴다.
- 무대를 세우는 데 쓴다. "한겨울 한복판에 난 사람" 과 "겨울이 막 시작된 자리" 는 다르다.
  term 의 날수가 그 차이를 말해 준다.
- **거기서 결론으로 넘어가지 않는다.** 계절이 무엇을 필요로 하는지(조후용신)는 다른 물음이고,
  그 답은 아직 승인되지 않았다.
    좋음: "한겨울, 그것도 소한이 지나고 보름 넘은 자리에 나셨어요. 굳어 있는 계절이에요."
    나쁨: "겨울에 나셨으니 불이 필요해요"          <- 조후용신. 승인 전이다.
    나쁨: "한랭한 명식이라 화 운이 오면 좋아져요"   <- 같은 자리. 더 나쁘다.
- 계절을 말할 때도 **조후·억부·용신 같은 낱말은 쓰지 않는다.** 쉬운 말로 쓴다.

## 조후·격국·용신
지시에 따로 딸려 오지 않는 한 아래 낱말을 한 번도 쓰지 않는다.
  용신 희신 기신 구신 한신 격국 조후 억부 상신 통관 병약
  정관격·편재격 같은 격 이름, 종격·화기격·건록격·양인격
이것들은 계산은 되어 있지만 **아직 아무도 승인하지 않은 판단**이다. 근거가 없어서가
아니라, 그 근거가 어느 판본에서 왔는지 확인되지 않아서다. 확인 전에 쓰면 지어낸 것과
구별되지 않는다.

그 칸이 왔을 때 지킬 것.
- **조후·억부·격국이 서로 다른 것을 가리키면 하나를 고르지 않는다.** 그건 계산이 덜 된
  것이 아니라 명리 안에서 실제로 갈리는 자리다. 고르는 순간 그 선택의 근거가 사라진다.
- 격 이름은 advanced.gyeokguk 이 그 이름을 줄 때만 부른다. 없으면 "구조로 보면"까지만.
- 범위를 밝힌다 — **"계절과 강약과 구조를 함께 보는 추가 관점"** 정도다.
  기존 절의 결론을 이것으로 번복하지 않는다.
- 격국·용신을 직업·재물·결혼·합격·재회 성공으로 옮기지 않는다. 그건 이 층이 답할 수
  있는 물음이 아니고, 그렇게 쓰는 순간 사주가 점이 된다.

# LIMITS
- 의료·법률·재무는 판정하지 않는다. 진단명, 법적 판단, 투자·대출 지시를 쓰지 않는다.
- 자해나 위기 신호가 읽히면 그 대목에서는 점을 풀지 말고, 사람에게 도움을 청하라고 짧게 권한다.
- 불안이나 죄책감을 키워 결제를 재촉하지 않는다. 결제·서비스·화면을 언급하지 않는다.

# OUTPUT CONTRACT
- JSON 객체 하나만 출력한다. 코드펜스, 설명 문장, 마크다운을 덧붙이지 않는다.
- **모든 문장은 예외 없이 해요체로 끝낸다.** 이건 브랜드 목소리라 어기면 폐기된다.
  합쇼체(-습니다/-입니다/-합니다/-됩니다)로 끝난 문장이 하나라도 있으면 안 된다.
  가집니다→가져요, 보입니다→보여요, 있습니다→있어요, 없습니다→없어요,
  됩니다→돼요, 합니다→해요, 만듭니다→만들어요, 짚어냅니다→짚어내요,
  이었습니다→이었어요, 그렇습니다→그래요, 아닙니다→아니에요, 드립니다→드려요.
  문어체 종결(-이다/-한다/-지요/-랍니다)도 쓰지 않는다.
- facts_used는 "경로=값" 꼴로 **정확히 3개**. 경로만 적지 않는다.
  상대 명식은 "partner_saju_facts." 대신 "상대."로 줄여 적는다.
  (예: "strength.label=신약", "상대.luckContext.yearly.tenGod=편재")
- 어떤 규칙을 썼는지는 facts_used가 아니라 rule_ids에 적는다.
- 목차 제목에 '반드시' 같은 단정 표현이 들어 있어도 본문으로 옮기지 않는다.
  제목은 상품 문구라 그대로 쓰지만, 네가 쓰는 문장에는 반드시·무조건·틀림없이·100%를
  쓰지 않는다. '특히', '주로', '이 지점에서' 처럼 단정하지 않는 말로 바꾼다.

## 지시가 "머리"일 때
{"report_meta":{"headline":"string","confidence_note":"string"},
"summary_cards":[{"label":"나의 중심","value":"string","detail":"string","facts_used":["string"]},{"label":"관계의 결","value":"string","detail":"string","facts_used":["string"]},{"label":"지금의 흐름","value":"string","detail":"string","facts_used":["string"]}],
"action_questions":[{"question":"string","why_it_matters":"string"},{"question":"string","why_it_matters":"string"},{"question":"string","why_it_matters":"string"}],
"character_note":{"character_id":"string","name":"string","message":"string"},
"next_step":{"label":"string","description":"string","recommended_focus":"relationship|work|timing"}}

- summary_cards는 정확히 3개, label은 위의 것을 그대로 쓴다.
- action_questions는 정확히 3개. 리포트를 다 읽은 사람이 오늘 해볼 수 있는 것으로 쓴다.
- headline 42~65자. 계산값에 근거한 판단을 담는다.
- character_note.message는 2문장 이하. sections는 만들지 않는다.

## 지시가 "본문"일 때
{"sections":[{"n":1,"verdict":"string","summary":"string","paragraphs":["string","string","string"],"facts_used":["string"],"rule_ids":["string"],"watch_out":"string","emotion_tags":["설렘"],"extra":{...}}]}

- sections 길이는 지시받은 항목 수와 정확히 같다. 합치거나 건너뛰지 않는다.
- n은 지시에 붙은 항목 번호를 그대로 적는다. 제목은 다시 적지 않는다 — 서버가 붙인다.

### emotion_tags — 삽화를 고르는 열쇠
각 절에 emotion_tags 를 1~3개 넣는다. 허용값은 아래 열 개뿐이며, 다른 말은 무시된다.

  설렘 · 기다림 · 망설임 · 끌림 · 흔들림 · 균열 · 단절 · 그리움 · 결심 · 회복

- 이 태그는 독자의 심리와 장면의 결을 나타낸다. 사주 계산의 근거를 대체하지 않는다.
- 삽화는 미리 그려 둔 것에서 고른다. 그러니 장면을 묘사하지 말고 결만 고른다.
- 병원·부상·자해·폭력·죽음·공포·눈물 같은 말을 시각 연출 제안으로 쓰지 않는다.
  그런 그림은 존재하지 않으며, 감정은 빛·간격·시선·자세·빈자리로만 드러낸다.

### verdict — 이 절의 답 한 줄
독자는 소제목을 보고 **"그래서 답이 뭔데"** 를 알고 싶어 한다. 1,200자를 다 읽어야
답이 나오면 그건 답을 미룬 것이다. verdict 는 그 답을 맨 앞에서 먼저 준다.

- **20~40자.** 한 문장. 마침표로 끝낸다.
- **답이어야 한다.** 소제목을 다시 쓰거나 "살펴볼게요" 같은 예고가 되면 안 된다.
    소제목: "그 사람, 아직 마음이 남아 있을까"
    나쁨:   "상대의 마음을 명식으로 살펴볼게요."      (예고)
    나쁨:   "남은 마음과 결심은 다른 상태예요."       (설명)
    좋음:   "마음은 남았는데, 움직일 결심은 아직이에요."
- **명리 용어를 한 개도 쓰지 않는다.** 여기만은 예외 없다.
- **강조 표기를 쓰지 않는다.** 이 줄 자체가 이미 강조다.
- summary 는 verdict 를 설명하는 자리다. 같은 문장을 반복하지 않는다.

### 길이 — 이건 협상 대상이 아니다
- **paragraphs 는 정확히 3개다.** 두 개만 쓰면 그 절은 폐기된다.
- **한 절은 1,200~1,500자다.** summary 340~420자 + 문단 3개 각 280~360자.
- 각 문단은 4~6문장이다. 두세 문장으로 끊고 다음 문단으로 넘어가지 않는다.
- 돈을 낸 사람이 읽는 글이다. 짧게 끝내는 것은 성의가 아니라 미완성이다.

### 길게 쓰는 법 — 늘어난 만큼 새로운 것을 말한다
같은 말을 바꿔 쓰거나 "그럴 수 있어요" 를 반복해 채우면 폐기된다. 길이는 이렇게 번다.
- **장면을 끝까지 그린다.** 언제, 어디서, 누가 먼저 무슨 말을 했고, 그때 상대 표정이
  어땠고, 그래서 어떻게 끝났는지. 한 장면을 다 그리면 그것만으로 300자가 나온다.
- **실제로 오갈 법한 말을 따옴표로 적는다.** "요즘 좀 지쳐 보여" 처럼.
- **숫자를 붙인다.** 몇 월, 며칠쯤, 몇 번째, 얼마 만에.

### 문단마다 할 일이 다르다
- summary: 이 절의 판단과 그 근거. 여기서 결론을 낸다. 뒤 문단은 요약을 다시 설명하는
  자리가 아니다.
- 첫 문단 — **당신 쪽에서 보이는 장면.** 대화, 답장 간격, 참았던 말, 반복되는 상황.
- 둘째 문단 — **상대 쪽에서는 같은 장면이 어떻게 보였는지, 그래서 왜 되풀이되는지.**
  여기가 이 리포트의 값이다. 같은 장면을 두 사람이 다르게 기억하는 지점을 짚는다.
  상대 명식이 있으면 그 근거로, 없으면 당신 명식이 만드는 태도에서 추론한다.
- 셋째 문단 — **지금 할 일.** 무엇을, 언제, 어떤 말로. 실행되지 않는 조언은 쓰지 않는다.
- 강조 표기(HIGHLIGHTS)를 절마다 4~6개 넣는다. 글자 수에는 표기를 세지 않는다.
  셋째 문단에는 [[행동|...]] 이 최소 하나 있어야 한다.

### extra — 절마다 모양을 바꾼다 (선택)
같은 모양이 열다섯 번 반복되면 내용과 무관하게 눈이 미끄러진다. 그래서 절마다
**이미 말한 것 중 하나를 다른 꼴로 다시 세울 수 있다.** 넷 중 하나를 고른다.

  {"kind":"quote","text":"..."}
      이 절의 결론 한 문장. 20~60자. 본문에 있는 말을 그대로 뽑는다.
  {"kind":"contrast","mine":"...","theirs":"..."}
      같은 장면을 두 사람이 어떻게 다르게 봤는지. 각 40~70자.
  {"kind":"timeline","points":[{"when":"2026년 8월","what":"..."}]}
      시기 2~3개. when 은 luckContext 에 근거가 있어야 한다. what 은 30~50자.
  {"kind":"checklist","items":["...","...","..."]}
      지금 할 일 2~3개. 각 20~40자. 실제로 실행되는 동작만.

규칙:
- **어느 절에 무엇을 붙일지는 네가 고르지 않는다.** 지시문의 항목 옆 대괄호에
  "[extra: quote]" 처럼 적혀 있다. 그대로 따른다.
  "[extra 없이]" 라고 적힌 절에는 extra 를 아예 넣지 않는다.
- 지정된 모양이 그 절 내용과 도무지 맞지 않으면(예: 시기 이야기가 없는데 timeline)
  **비워도 된다.** 억지로 채우면 없는 내용을 지어내게 된다.
- **새로운 내용을 만들지 않는다.** extra 는 그 절이 이미 한 말을 다시 세우는 자리다.
  extra 에만 있고 본문에는 없는 판단이 나오면 그 리포트는 폐기된다.
- extra 안에는 강조 표기를 쓰지 않는다. 이미 그 자체로 강조된 자리다.
`;

export interface ReadingInput {
  facts: SajuFacts;
  partnerFacts: SajuFacts | null;
  /** 이 명식에서 켜진 검수 규칙 — 해석의 뼈대가 된다 */
  matchedRules: ReadingRule[];
  productLabel: string;
  outline: string[];
  focus: string;
  currentScene: string;
  /**
   * 사용자가 적은 직업. 비어 있을 수 있다.
   *
   * **계산에 들어가지 않는다.** 명식은 생년월일시로 정해지고 직업은 그 입력이 아니다.
   * 이건 오직 장면을 고르는 데만 쓴다 — 같은 흐름도 3교대 간호사와 프리랜서에게
   * 다른 모습으로 나타나므로, 직업을 알면 "답장이 늦어요" 대신 그 사람의 하루에서
   * 실제로 일어나는 장면을 쓸 수 있다.
   */
  occupation?: string;
  characterId: string | null;
  characterName: string | null;
  now: Date;
}

/**
 * 계산 결과에서 모델이 실제로 인용하는 것만 남긴다.
 *
 * 원본 SajuFacts를 그대로 실으면 한 리딩에 입력 6만 자가 나간다 — 조각마다
 * 같은 명식을 다시 보내기 때문에 낭비가 조각 수만큼 곱해진다. 여기서 줄이는
 * 한 글자는 요청 수만큼 줄어든다.
 *
 * 지우는 것: 들여쓰기, 매번 같은 계산 주석, 신살 유도 과정.
 * 남기는 것: 근거로 인용될 수 있는 값 전부. facts_used의 경로가 바뀌지 않도록
 * 키 이름은 그대로 둔다.
 */
/**
 * 모델이 실제로 보는 값. 가드가 facts_used 경로를 검사할 때도 이 모양을 기준으로 삼는다
 * — 모델이 본 것과 검사하는 것이 다르면 그 검사는 거짓말을 한다.
 */
export function slimFacts(facts: SajuFacts) {
  const pillar = (p: { stem: string; branch: string } | null) => (p ? `${p.stem}${p.branch}` : null);
  return {
    gender: facts.gender,
    fourPillars: {
      year: pillar(facts.fourPillars.year),
      month: pillar(facts.fourPillars.month),
      day: pillar(facts.fourPillars.day),
      hour: pillar(facts.fourPillars.hour),
    },
    dayMaster: facts.dayMaster,
    dayMasterElement: facts.dayMasterElement,
    elementBalance: facts.elementBalance,
    missingElements: facts.missingElements,
    strength: facts.strength,
    // 배열 7개를 자리별 한 줄로 접는다. "tenGods.일지" 경로는 그대로 살아 있다.
    tenGods: Object.fromEntries(facts.tenGods.map((t) => [t.position, `${t.character} ${t.tenGod}`])),
    dominantTenGods: facts.dominantTenGods,
    // 같은 글자에 걸린 합·충·형을 한 줄로 묶어 준다. 따로 보내면 사신합과
    // 사신형이 두 개의 독립된 구조로 읽힌다 — 실제로는 같은 두 글자다.
    relationBundles: Object.fromEntries(
      facts.relationBundles.map((b) => [
        b.id,
        `${b.relations
          .map((r) => (r.completeness === "partial" ? `${r.label}(부분)` : r.label))
          .join("+")}@${b.positions.map((p) => p.role).join(",")}`,
      ])
    ),
    // 천간합은 글자 축이 달라 지지 번들과 겹치지 않는다. 따로 둔다.
    stemCombos: facts.notableRelations
      .filter((r) => r.kind === "천간합")
      .map((r) => `${r.label}=${r.pillarPositions.join(",")}`),
    // basis(유도 과정)는 빼고 이름과 자리만 남긴다. 모델이 인용하는 것은 그 둘뿐이다.
    shinsal: facts.shinsal.map((f) => `${f.name}=${f.positions.join(",")}`),
    // 타고난 형은 relationBundles 안에 들어가 있다 — 합·충과 같은 자리를 두 번
    // 세지 않기 위해서다. 운에서 들어온 형만 여기 따로 둔다. 섞으면 "늘 그렇다"와
    // "지금 그렇다"가 한 문장으로 붙어버린다.
    xingLuck: xingLines(facts.xingLuck),
    // 앞으로의 달은 한 줄씩 접는다. 객체로 보내면 여섯 달이 입력의 큰 몫을 먹는데,
    // 모델이 인용하는 것은 "언제·무슨 기운" 둘뿐이다.
    luckContext: {
      majorLuck: facts.luckContext.majorLuck,
      yearly: facts.luckContext.yearly,
      monthly: facts.luckContext.monthly,
      upcoming: facts.luckContext.upcoming.months.map(
        (m) =>
          `${m.year}-${String(m.month).padStart(2, "0")} ${m.pillar.stem}${m.pillar.branch} ${m.tenGod}`
      ),
      nextYear: facts.luckContext.upcoming.nextYear
        ? `${facts.luckContext.upcoming.nextYear.year} ` +
          `${facts.luckContext.upcoming.nextYear.pillar.stem}${facts.luckContext.upcoming.nextYear.pillar.branch} ` +
          `${facts.luckContext.upcoming.nextYear.tenGod}`
        : null,
    },
    // 조후는 표가 승인되고 우선순위가 정해져야 나간다. 그 전에는 계산만 하고
    // 모델에게 주지 않는다 — 출처 없는 결론이 사용자에게 가는 것을 막는다.
    ...(facts.johu.exposable
      ? {
          johu: {
            climate: facts.johu.climate,
            need: facts.johu.seasonalNeed.map(
              (n) => `${n.element}=${n.role}${n.presentInChart ? "" : "(명식에 없음)"}`
            ),
            conflictsWithStrength: facts.johu.conflictsWithStrength,
            conflictResolution: facts.johu.conflictResolution ?? null,
          },
        }
      : {}),
    // 고급 해석은 여기 싣지 않는다.
    //
    // 조각마다 같은 JSON 이 가므로, 계절을 여기 실으면 조각 다섯이 각자 계절로
    // 글을 연다. "리포트 전체에서 한 번"은 조각 하나가 지킬 수 없는 지시다 —
    // 옆 조각이 이미 썼는지 알 길이 없기 때문이다. 실제로 gpt-5.6 이 열한 번 썼다.
    //
    // 그래서 서버가 정해서 **첫 묶음의 지시문에만** 붙인다(seasonBrief).
    // 덤으로 이 JSON 이 조각마다 같아져서 프롬프트 캐시가 통째로 먹는다.
    // 매번 같은 계산 주석(표준시·진태양시·절기)은 뺀다. confidence_note에 반영해야 할
    // 한계(시각 미상, 음력 변환)만 남긴다.
    limits: facts.calculationNotes.filter((n) => LIMIT_NOTE.test(n)),
  };
}

/**
 * 운에서 들어온 형을 신살과 같은 모양으로 접는다 — 이름=자리.
 * 이름은 xing-name.ts 가 짓는다. 부분 성립이면 실제로 선 글자로만 이름이 나온다.
 */
function xingLines(relations: XingRelation[]): string[] {
  return completeXing(relations).map(xingLine);
}

/**
 * 첫 묶음에만 붙일 계절 한 줄.
 *
 * 열린 칸이 없으면 빈 문자열이다. 그때 모델은 계절을 아예 못 본다 — 보면 쓴다.
 */
export function seasonBrief(facts: SajuFacts): string {
  const advanced = advancedForPrompt(facts.advanced) as
    | { season?: Record<string, string> }
    | null;
  const season = advanced?.season;
  if (!season) return "";
  return (
    `계절(이 리포트에서 한 번만, 첫 절에): ${season.season} · ${season.month_branch}월 · ` +
    `${season.climate} · ${season.term}` +
    (season.boundary ? ` · ${season.boundary}` : "")
  );
}

/** confidence_note에 반영해야 할 한계만 골라내는 표시 */
const LIMIT_NOTE = /(미상|모름|음력|추정|불명)/;

/** 모델에 넘길 입력 JSON — 계산 결과와 사용자 맥락만 담는다 */
export function buildReadingInput(input: ReadingInput): string {
  const payload = {
    saju_facts: slimFacts(input.facts),
    partner_saju_facts: input.partnerFacts ? slimFacts(input.partnerFacts) : null,
    matched_rules: rulesForPrompt(input.matchedRules),
    user_context: {
      focus: input.focus,
      current_scene: input.currentScene || null,
      // 계산값이 아니다. 장면을 고르는 데만 쓴다 — EVIDENCE POLICY 참조.
      occupation: input.occupation?.trim() || null,
      today: `${input.now.getFullYear()}-${String(input.now.getMonth() + 1).padStart(2, "0")}`,
    },
    delivery: {
      report_type: input.productLabel,
      character_name: input.characterName,
    },
  };
  // 들여쓰기를 빼면 같은 내용이 3분의 2 크기가 된다. 모델은 압축 JSON도 그대로 읽는다.
  return JSON.stringify(payload);
}

type RawSection = {
  id?: string;
  nav_label?: string;
  title?: string;
  summary?: string;
  paragraphs?: unknown;
  facts_used?: unknown;
  rule_ids?: unknown;
  watch_out?: string;
  emotion_tags?: unknown;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

/**
 * 모델 응답에서 JSON을 꺼낸다. 코드펜스나 앞뒤 잡음이 붙어 나오는 경우가 있어
 * 첫 중괄호부터 마지막 중괄호까지를 잘라 한 번 더 시도한다.
 */
export function parseStructuredReport(text: string): StructuredReport | null {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const braced = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (braced.length > 2) attempts.push(braced);

  for (const candidate of attempts) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
    const meta = (raw.report_meta ?? {}) as Record<string, unknown>;
    const sections = Array.isArray(raw.sections) ? (raw.sections as RawSection[]) : [];
    if (sections.length === 0) continue;

    const character = raw.character_note as Record<string, unknown> | undefined;
    const next = raw.next_step as Record<string, unknown> | undefined;

    return {
      meta: {
        // title과 reading_time_min은 화면 어디에도 쓰이지 않는다. 모델에게 시키지 않고
        // 여기서 채운다 — 출력 토큰이 곧 비용이라, 안 읽는 글자를 사지 않는다.
        title: typeof meta.title === "string" ? meta.title : "",
        headline: typeof meta.headline === "string" ? meta.headline : "",
        readingTimeMin: typeof meta.reading_time_min === "number" ? meta.reading_time_min : 6,
        disclaimer:
          typeof meta.disclaimer === "string" && meta.disclaimer.trim()
            ? meta.disclaimer
            : "오락 및 자기성찰을 위한 참고 해석이에요.",
        confidenceNote: typeof meta.confidence_note === "string" ? meta.confidence_note : "",
      },
      summaryCards: (Array.isArray(raw.summary_cards) ? raw.summary_cards : [])
        .map((card) => card as Record<string, unknown>)
        .filter((card) => typeof card.label === "string" && typeof card.value === "string")
        .map((card) => ({
          label: card.label as string,
          value: card.value as string,
          detail: typeof card.detail === "string" ? card.detail : "",
          factsUsed: asStringArray(card.facts_used),
        })),
      sections: sections
        .filter((section) => typeof section.title === "string" && section.title.trim())
        .map((section) => ({
          id: typeof section.id === "string" ? section.id : "core",
          navLabel: typeof section.nav_label === "string" && section.nav_label.trim() ? section.nav_label : (section.title as string),
          title: section.title as string,
          summary: typeof section.summary === "string" ? section.summary : "",
          paragraphs: asStringArray(section.paragraphs),
          factsUsed: asStringArray(section.facts_used),
          ruleIds: asStringArray(section.rule_ids),
          watchOut: typeof section.watch_out === "string" ? section.watch_out : undefined,
          // 허용 목록 밖의 말은 여기서 사라진다. 모델이 무엇을 뱉든 그림에 닿지 못한다.
          emotionTags: normalizeEmotionTags(asStringArray(section.emotion_tags)),
        })),
      actionQuestions: (Array.isArray(raw.action_questions) ? raw.action_questions : [])
        .map((item) => item as Record<string, unknown>)
        .filter((item) => typeof item.question === "string")
        .map((item) => ({
          question: item.question as string,
          whyItMatters: typeof item.why_it_matters === "string" ? item.why_it_matters : "",
        }))
        .slice(0, 3),
      characterNote:
        character && typeof character.message === "string"
          ? {
              characterId: typeof character.character_id === "string" ? character.character_id : "",
              name: typeof character.name === "string" ? character.name : "",
              message: character.message,
            }
          : null,
      nextStep:
        next && typeof next.label === "string"
          ? {
              label: next.label,
              description: typeof next.description === "string" ? next.description : "",
              recommendedFocus: typeof next.recommended_focus === "string" ? next.recommended_focus : "relationship",
            }
          : null,
    };
  }
  return null;
}

/**
 * 구조화 리포트를 기존 저장 형식(티저 + 본문 텍스트)으로 옮긴다.
 * 결제·보관함·추가 상담이 모두 이 텍스트를 쓰고 있어, 구조가 바뀌어도 뒤가 깨지지 않게 한다.
 */
/**
 * 저장·공유·추가 상담에 쓰는 순수 텍스트.
 *
 * 강조 표기는 여기서 전부 걷어낸다. 화면이 아닌 곳으로 나가는 글에 대괄호가 섞이면
 * 읽는 사람에게는 잡음이고, 추가 상담 프롬프트로 들어가면 모델이 그 표기를 흉내 내기
 * 시작한다. 색은 뷰어가 구조화 리포트에서 직접 읽어 칠한다.
 */
export function reportToText(report: StructuredReport): { teaser: string; full: string } {
  const plain = (text: string) => stripMarks(text);

  const teaser = [
    plain(report.meta.headline),
    report.summaryCards.map((card) => `${card.label}: ${plain(card.value)}`).join(" / "),
    plain(report.summaryCards[0]?.detail ?? ""),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 600);

  const body = report.sections
    .map((section) => {
      const lines = [
        `■ ${section.title}`,
        section.verdict ? plain(section.verdict) : "",
        plain(section.summary),
        ...section.paragraphs.map(plain),
      ];
      // 모양은 화면에만 있고, 저장되는 원문에는 내용만 남는다
      const extra = extraToText(section.extra, plain);
      if (extra) lines.push(extra);
      if (section.watchOut) lines.push(`살펴볼 점: ${plain(section.watchOut)}`);
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");

  const questions = report.actionQuestions.length
    ? `\n\n■ 스스로 확인할 세 가지\n${report.actionQuestions
        .map((q, i) => `${i + 1}. ${plain(q.question)} — ${plain(q.whyItMatters)}`)
        .join("\n")}`
    : "";
  const note = report.characterNote
    ? `\n\n■ ${report.characterNote.name}의 한마디\n${plain(report.characterNote.message)}`
    : "";

  return { teaser, full: `${body}${questions}${note}`.trim() };
}
