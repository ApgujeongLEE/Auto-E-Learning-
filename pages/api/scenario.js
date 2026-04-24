export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
        messages: [{ role: 'user', content: `교육 주제: ${topic}\n학습 대상: ${audience}\n수준: ${level}\n목표:\n${objectives}\n길이: ${duration}\n장면수: ${scenes}장면\n톤: ${tone}\n${extra ? '추가: ' + extra : ''}\n\nJSON으로 시나리오 작성.` }]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const raw = data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    let scenario;
    try { scenario = JSON.parse(raw); }
    catch (_) {
      let f = raw, lc = f.lastIndexOf('},');
      if (lc > 0) f = f.slice(0, lc + 1);
      const o = (f.match(/\{/g)||[]).length-(f.match(/\}/g)||[]).length;
      const a = (f.match(/\[/g)||[]).length-(f.match(/\]/g)||[]).length;
      for (let i=0;i<o;i++) f+='}';
      for (let i=0;i<a;i++) f+=']';
      scenario = JSON.parse(f);
    }
    res.status(200).json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
