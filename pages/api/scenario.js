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
        system: `이러닝 시나리오 작가. 순수 JSON만 출력. 마크다운 금지.

형식: {"title":"","summary":"","scenes":[{"scene_no":1,"chapter":"","duration_sec":0,"screen_prompt":"","narration":""}]}

screen_prompt 규칙 (절대 준수):
- 영어로 작성
- 반드시 아래 멀티샷 구조로 시작:
  "SHOT 1: [구도 묘사] → SHOT 2: [구도 묘사] → SHOT 3: [구도 묘사], smooth natural cuts, [배경], [조명], cinematic 4K"
- 모든 SHOT에 "Korean professional instructor, upper body and hands fully visible" 포함
- 강사 행동은 해당 씬 narration 내용과 일치시킬 것
- SHOT 유형 조합 예시:
  · SHOT 1: Medium shot, instructor speaking to camera, confident hand gesture
  · SHOT 2: Close-up on instructor face and hands emphasizing key point  
  · SHOT 3: Medium shot, instructor concluding with warm smile
- 배경: modern studio with gradient background, three-point studio lighting
- 금지: 강사 없는 장면 단독 구성, cartoon, text overlay

narration 규칙:
- 자연스러운 한국어 구어체, 강사가 직접 말하는 톤
- duration_sec 분량에 맞게 (초당 5~6음절)`,
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

JSON으로 시나리오를 작성하세요.

screen_prompt 예시 (이 형식을 반드시 따를 것):
"SHOT 1: Wide shot, Korean professional instructor in modern studio walks toward camera with warm smile → SHOT 2: Medium shot, instructor upper body and hands visible, explaining concept with open-palm gesture speaking directly to camera → SHOT 3: Close-up on instructor's face and hands as she emphasizes key point with finger gesture, smooth natural cuts between shots, modern studio gradient background, three-point studio lighting with rim light, cinematic 4K"

narration 예시: "안녕하세요, 여러분. 오늘은 함께 [주제]에 대해 알아볼 거예요. 먼저 가장 핵심적인 개념부터 시작해 볼까요?"

모든 장면의 screen_prompt를 위 예시와 동일한 SHOT 1 → SHOT 2 → SHOT 3 구조로 작성하세요.`
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
