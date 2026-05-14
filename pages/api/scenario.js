export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 환경변수 확인 (디버그용)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' });
  }
  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(500).json({ error: `API Key 형식 오류: ${apiKey.substring(0, 10)}...` });
  }

  const { topic, audience, level, objectives, duration, scenes, tone, extra } = req.body;

  if (!topic || !audience || !objectives) {
    return res.status(400).json({ error: '교육 주제, 학습 대상, 학습 목표를 입력해주세요.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: `당신은 이러닝 시나리오 전문 작가이자 영상 디렉터입니다. 반드시 순수 JSON만 출력하세요. 마크다운 없이.

출력 형식:
{"title":"","summary":"","scenes":[{"scene_no":1,"chapter":"","duration_sec":0,"screen_prompt":"","narration":""}]}

━━━ screen_prompt 작성 규칙 (Seedance 2.0 멀티샷 최적화) ━━━

1. 반드시 영어로 작성

2. 멀티샷 구조 사용 (Seedance의 핵심 강점):
   각 프롬프트를 "SHOT 1 → SHOT 2 → SHOT 3" 형식으로 작성하여
   하나의 씬 안에서 자연스러운 컷 전환이 일어나도록 구성

3. 기본 멀티샷 템플릿:
   "SHOT 1: [wide/establishing shot 묘사] → 
    SHOT 2: [medium shot, Korean instructor upper body and hands visible, action] → 
    SHOT 3: [close-up on face or hands for emphasis], 
    smooth natural cuts between shots, 
    [배경], [조명], professional educational video, cinematic 4K"

4. 장면 유형별 멀티샷 구성:
   - 인트로: 
     "SHOT 1: Wide shot of modern studio, instructor walks into frame →
      SHOT 2: Medium shot, Korean instructor smiling at camera, welcoming gesture →
      SHOT 3: Close-up on instructor's confident face"
   
   - 개념 설명:
     "SHOT 1: Medium shot, Korean instructor speaking to camera, hands gesturing →
      SHOT 2: Close-up on instructor's hands illustrating the concept →
      SHOT 3: Medium shot, instructor looking directly at camera with clear expression"
   
   - 실습/시연:
     "SHOT 1: Over-the-shoulder shot showing instructor pointing at screen →
      SHOT 2: Medium shot, instructor demonstrating with hand movements →
      SHOT 3: Close-up on instructor's face explaining key insight"
   
   - 핵심 정리:
     "SHOT 1: Medium shot, instructor summarizing with counting gesture →
      SHOT 2: Close-up on instructor's face, serious and clear expression →
      SHOT 3: Wide medium shot, instructor with confident concluding posture"

5. 카메라 무브먼트 키워드 (Seedance 지원):
   - slow push-in (강조할 때)
   - slight pan left/right (시선 유도)
   - static camera (안정감)
   - gentle zoom (집중 유도)

6. 강사 묘사 고정 요소:
   Korean professional instructor, upper body and hands fully visible,
   business casual or professional attire, natural makeup,
   confident and warm expression, speaking directly to camera

7. 배경/조명 옵션:
   - modern studio with gradient background, soft key light + rim light
   - clean minimal office, large window natural light
   - professional broadcast setup, three-point lighting

8. 반드시 포함할 키워드:
   "smooth natural cuts", "multi-shot sequence", "professional educational video", "cinematic 4K"

9. 나레이션 내용 반영:
   해당 씬의 narration 핵심 키워드를 강사의 행동/표정에 반드시 반영
   (예: 숫자 언급 → 손가락으로 카운팅, 강조 → 손바닥을 앞으로 펼침)

10. 금지: cartoon, animation, text overlay, watermark, CGI

━━━ narration 작성 규칙 ━━━
- 강사가 직접 시청자에게 말하는 자연스러운 한국어 구어체
- 해당 장면 duration_sec에 맞는 분량 (초당 약 5~6음절)
- 친근하고 명확한 설명, 학습 대상 수준에 맞는 용어`,
        messages: [{
          role: 'user',
          content: `교육 주제: ${topic}
학습 대상: ${audience}
수준: ${level}
학습 목표:
${objectives}
영상 길이: ${duration}
장면 수: ${scenes}장면
톤: ${tone}
${extra ? '추가 요청: ' + extra : ''}

위 정보로 이러닝 시나리오를 JSON으로 작성하세요.

screen_prompt 필수 조건:
- 한국인 강사(상반신+손이 보이는 미디엄샷)가 메인으로 등장
- 각 장면의 교육 내용에 맞게 강사의 행동/표정/손짓을 구체적으로 묘사
- Seedance AI에 최적화된 영어 프롬프트
- 장면마다 카메라 구도, 배경, 조명, 분위기를 명시

narration 필수 조건:
- 강사가 직접 시청자에게 말하는 자연스러운 한국어
- 해당 장면 duration_sec에 맞는 분량 (초당 약 5~6음절)
- ${tone} 톤 유지`
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();

    // JSON 파싱 + 잘림 복구
    let scenario;
    try {
      scenario = JSON.parse(raw);
    } catch (_) {
      let fixed = raw;
      const lc = fixed.lastIndexOf('},');
      if (lc > 0) fixed = fixed.slice(0, lc + 1);
      const opens = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
      const arrOpens = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < opens; i++) fixed += '}';
      for (let i = 0; i < arrOpens; i++) fixed += ']';
      scenario = JSON.parse(fixed);
    }

    res.status(200).json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
