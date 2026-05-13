export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64 } = req.body;
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'IMGBB_API_KEY 환경변수가 없습니다.' });
  if (!imageBase64) return res.status(400).json({ error: '이미지 데이터가 없습니다.' });

  try {
    const form = new URLSearchParams();
    form.append('key', apiKey);
    form.append('image', imageBase64.replace(/^data:image\/\w+;base64,/, ''));

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form,
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'ImgBB 업로드 실패');

    return res.status(200).json({ url: data.data.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
