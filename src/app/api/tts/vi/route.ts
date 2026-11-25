import { overLimit, tooMany } from '@/lib/rate-limit';

const MAX_TTS_LENGTH = 260;
/** The reader sends clauses of at most 165 characters; a longer `text` is not from the reader, so it is refused before any work. */
const MAX_RAW_LENGTH = 600;
/** Per visitor and minute: the reader asks once per clause (a few seconds each), so 60 is far above reading and far below scraping. */
const TTS_VI_LIMIT_PER_MINUTE = 60;

function normalizeVietnameseTtsText(raw: string): string {
  return raw
    .replace(/\bTP\.\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bHT\.\s*/g, 'Hòa thượng ')
    .replace(/\bÂL\b/g, 'Âm lịch')
    .replace(/\b(\d{1,2})h(\d{2})\b/gi, '$1 giờ $2 phút')
    .replace(/[–—]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Web `Request`/`Response` rather than NextRequest/NextResponse: the same on the Worker, and a test can call it without Next.
export async function GET(req: Request) {
  try {
    // The proxy spends Google's voice service on the visitor's behalf: count it like the AI routes, before anything else.
    if (await overLimit(req, 'tts-vi', TTS_VI_LIMIT_PER_MINUTE)) return tooMany();
    const rawText = new URL(req.url).searchParams.get('text') || '';
    if (rawText.length > MAX_RAW_LENGTH) {
      return Response.json({ error: 'Nội dung quá dài để đọc' }, { status: 400 });
    }
    const cleaned = normalizeVietnameseTtsText(rawText);

    if (!cleaned) {
      return Response.json({ error: 'Thiếu nội dung text cần đọc' }, { status: 400 });
    }

    const capped = cleaned.slice(0, MAX_TTS_LENGTH);
    const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(
      capped
    )}`;

    const upstream = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://translate.google.com/',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `Không thể lấy giọng đọc (${upstream.status})` },
        { status: 502 }
      );
    }

    const audioBuffer = await upstream.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: unknown) {
    // Không trả chi tiết lỗi của lần gọi Google ra ngoài.
    console.error('[API /api/tts/vi] Lỗi:', err);
    return Response.json({ error: 'Lỗi dịch vụ đọc tiếng Việt' }, { status: 500 });
  }
}
