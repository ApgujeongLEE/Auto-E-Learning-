import { put } from '@vercel/blob';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, fileName } = req.body;
  if (!imageBase64) return res.status(400).json({ error: '이미지 데이터가 없습니다.' });

  try {
    // base64 → Buffer 변환
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 파일 확장자 추출
    const ext = imageBase64.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpg';
    const name = fileName || `scene-${Date.now()}.${ext}`;

    // Vercel Blob에 업로드
    const blob = await put(`uploads/${name}`, buffer, {
      access: 'public',
      contentType: `image/${ext}`,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
