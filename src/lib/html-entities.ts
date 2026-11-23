/**
 * 🪷 BỘ GIẢI MÃ THỰC THỂ HTML (HTML ENTITY DECODER) CHUẨN XÁC TOÀN DIỆN
 * Tự động chuyển đổi toàn bộ các mã ký tự HTML do WordPress Gutenberg / WordPress REST API sinh ra:
 * &#8220; -> “ (ngoặc kép mở)
 * &#8221; -> ” (ngoặc kép đóng)
 * &#8216; -> ‘ (ngoặc đơn mở)
 * &#8217; -> ’ (ngoặc đơn đóng)
 * &#8230; -> … (dấu ba chấm)
 * &#8211; -> – (gạch ngang ngắn)
 * &#8212; -> — (gạch ngang dài)
 * &#8243; -> ″ (kép phút/giây)
 * &quot; -> "
 * &amp; -> &
 * &#038; -> &
 * &nbsp; -> khoảng trắng
 * Và toàn bộ các mã thập phân/thập lục phân &#...; khác.
 */

const NAMED: Record<string, string> = {
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…',
  laquo: '«', raquo: '»', amp: '&', nbsp: ' ', lt: '<', gt: '>', bull: '•', copy: '©', reg: '®', trade: '™',
};

/**
 * One pass over the text, so a decoded "&" can never start a second entity: "&amp;lt;" is the text "&lt;", not "<".
 * (The admin stores a verse line with & < > escaped as &amp; &lt; &gt;, and the page must show them as typed.)
 */
export function decodeHtmlEntities(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
      if (body[0] === '#') {
        const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        if (code === 38) return '&';
        if (code === 160) return ' ';
        return code >= 32 ? String.fromCodePoint(code) : '';
      }
      return NAMED[body] ?? whole;
    })
    .normalize('NFC');
}
