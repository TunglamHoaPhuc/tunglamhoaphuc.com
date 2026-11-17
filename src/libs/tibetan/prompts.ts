// What the Tibetan course asks Workers AI (T17b). The old site's server answered from a fixed
// template that read བཀྲ་ཤིས་བདེ་ལེགས as "Đất đai"; a language model reads it as Tashi Delek.
// The answer keeps the field names the course's app.js already draws (renderSliderContent).

export const MODEL = "@cf/google/gemma-4-26b-a4b-it";

type Message = { role: "system" | "user"; content: string };

const TEACHER =
	"Bạn là thầy dạy tiếng Tạng (giáo trình Sara, Dharamsala) cho người Việt học Phật pháp. " +
	"Chuyển tự theo Wylie (EWTS) chuẩn, phiên âm theo giọng Lhasa bằng chữ Latin dễ đọc. " +
	"Viết tiếng Việt có dấu, ngắn gọn, chính xác; không bịa nghĩa khi không chắc, khi đó nói rõ là chưa chắc.";

const ANALYSIS_SHAPE = `{
  "wylie": "chuyển tự Wylie của cả câu",
  "full_translation": "nghĩa tiếng Việt của cả câu",
  "dictionary": { "vn": "nghĩa ngắn", "usage": "dùng khi nào" },
  "table_rows": [ { "tibetan": "một từ", "phonetic": "phiên âm Lhasa", "wylie": "Wylie", "meaning": "nghĩa tiếng Việt", "pos": "từ loại tiếng Việt" } ],
  "syllables": [ {
    "syllable": "một âm tiết", "wylie": "Wylie", "root": "chữ gốc", "prefix": "tiền tố hoặc -", "suffix": "hậu tố hoặc -", "vowel": "nguyên âm a/i/u/e/o",
    "spelling_steps": ["các bước đánh vần như sách Tạng"],
    "coach_guide": { "root_guide": { "ipa": "IPA", "tone": "thanh cao/thấp", "aspiration": "bật hơi hay không", "guide": "khẩu hình" }, "correction_tips": ["lỗi người Việt hay mắc"] }
  } ],
  "usage_context": { "situation": "dùng trong hoàn cảnh nào", "cultural_notes": "ghi chú văn hóa", "dialogue_examples": [] },
  "buddhist_context": { "scripture_quote": "câu kinh liên quan nếu có", "teachings": "ý nghĩa Phật pháp", "philosophy_reflection": "suy ngẫm ngắn" }
}`;

/** The messages that ask for the analysis of a Tibetan text, as one JSON object. */
export function analysisMessages(text: string): Message[] {
	return [
		{ role: "system", content: `${TEACHER} Chỉ trả lời bằng một đối tượng JSON đúng khuôn sau, không thêm chữ nào ngoài JSON:\n${ANALYSIS_SHAPE}` },
		{ role: "user", content: `Phân tích đoạn tiếng Tạng: ${text}` },
	];
}

/** The messages for a question of the learner about a Tibetan text. */
export function askMessages(question: string, target: string): Message[] {
	return [
		{ role: "system", content: `${TEACHER} Trả lời bằng Markdown đơn giản (đậm, gạch đầu dòng), dưới 250 chữ.` },
		{ role: "user", content: target ? `Đoạn tiếng Tạng đang học: ${target}\n\nCâu hỏi: ${question}` : question },
	];
}
