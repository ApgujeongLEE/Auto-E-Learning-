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
        system: `이러닝 시나리오 전문 작가. 반드시 순수 JSON만 출력. 마크다운 없이.
형식: {"title":"","summary":"","scenes":[{"scene_no":1,"chapter":"","duration_sec":0,"screen_prompt":"영어 Kling/Veo용 장면묘사","narration":"한국어 ElevenLabs TTS용 내레이션"}]}`,
        messages: [{
          role: 'user',
          content: `교육 주제: ${topic}
학습 대상: ${audience}
수준: ${level}
목표:
${objectives}
길이: ${duration}
장면수: ${scenes}장면
톤: ${tone}
${extra ? '추가: ' + extra : ''}

JSON으로 시나리오 작성. screen_prompt 영어 구체적, narration 자연스러운 한국어.`
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
