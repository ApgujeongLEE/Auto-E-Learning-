export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { narration, voiceId } = req.body;
  if (!narration) return res.status(400).json({ error: '내레이션 텍스트가 없습니다.' });

  const clientId = process.env.CLOVA_CLIENT_ID;
  const clientSecret = process.env.CLOVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'CLOVA API 환경변수가 설정되지 않았습니다.' });
  }

  try {
    const params = new URLSearchParams();
    params.append('speaker', voiceId || 'nara');
    params.append('text', narration);
    params.append('volume', '0');
    params.append('speed', '-1');
    params.append('pitch', '0');
    params.append('format', 'mp3');

    const response = await fetch('https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`CLOVA 오류 ${response.status}: ${errText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="narration.mp3"');
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
