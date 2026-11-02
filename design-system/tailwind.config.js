/**
 * TÙNG LÂM HÒA PHÚC — Tailwind theme v1.0.0 (2026-11-02)
 * Dùng kèm design-system/tokens.css (bắt buộc import trước để có biến --tlhp-*).
 *  - Tailwind v3.4: trỏ "content" về mã nguồn và dùng như bình thường.
 *  - Tailwind v4:   trong globals.css → @import "tailwindcss"; @config "./tailwind.config.js";
 *  - Nếu package.json có "type": "module" → đổi tên file thành tailwind.config.cjs.
 * Màu vai trò (background, foreground, primary…) đọc biến CSS nên tự đổi theo
 * chủ đề Ngà / Giấy dó / Đêm thiền và trong section .tlhp-dark.
 * Màu gốc (moc, hoaisac, chusa, dong, da, nen) là HEX cố định.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Màu gốc (primitive) ──
        moc: { 50: '#FAF5EE', 100: '#F2E6D5', 200: '#E3CBA8', 300: '#CFA874', 400: '#B48446', 500: '#9A6A2A', 600: '#835414', 700: '#6B4413', 800: '#523417', 900: '#2C1C11', 950: '#1A120B' }, // Mộc – nâu trầm thiền môn (vỏ cây → gỗ lim)
        hoaisac: { 50: '#FDF8F1', 100: '#F8ECDA', 200: '#EFD8B9', 300: '#E3BE93', 400: '#D4A373', 500: '#C08752', 600: '#A26C3B', 700: '#7A4E28', 800: '#5C3B20', 900: '#402A18' }, // Hoại sắc – vàng đất cà sa / hổ phách
        chusa: { 50: '#FBEEEB', 100: '#F5D6CF', 200: '#E9AA9D', 300: '#D97A66', 400: '#C2503A', 500: '#A83420', 600: '#942313', 700: '#7A1C10', 800: '#5E160D', 900: '#3F0F09' }, // Chu sa – đỏ sơn son (lấy mẫu từ logo Mộc Ấn)
        dong: { 100: '#F3E6CC', 200: '#E6CFA0', 300: '#D8B77E', 400: '#CCA36A', 500: '#B48B53', 600: '#946F3F', 700: '#73552F' }, // Đồng – ánh kim cho đường viền trang trọng (từ khung logo)
        da: { 50: '#F7F6F2', 100: '#EDEAE3', 200: '#DDD8CD', 300: '#C4BDAF', 400: '#A39B8B', 500: '#7F776A', 600: '#635C51', 700: '#4B453D', 800: '#35302B', 900: '#232122' }, // Đá – xám đá tự nhiên (ấm)
        nen: { 'ngoc': '#FFFEFA', 'nga': '#FAFAF5', 'kem': '#F4ECDD', 'do': '#EFE6D3' }, // Nền – giấy & ngọc

        // ── Màu vai trò (theo chủ đề) ──
        background: { DEFAULT: 'rgb(var(--tlhp-c-bg) / <alpha-value>)', alt: 'rgb(var(--tlhp-c-bg-alt) / <alpha-value>)' },
        surface: 'rgb(var(--tlhp-c-surface) / <alpha-value>)',
        foreground: 'rgb(var(--tlhp-c-fg) / <alpha-value>)',
        heading: 'rgb(var(--tlhp-c-heading) / <alpha-value>)',
        muted: 'rgb(var(--tlhp-c-muted) / <alpha-value>)',
        primary: { DEFAULT: 'rgb(var(--tlhp-c-primary) / <alpha-value>)', hover: 'rgb(var(--tlhp-c-primary-hover) / <alpha-value>)', foreground: 'rgb(var(--tlhp-c-primary-fg) / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--tlhp-c-accent) / <alpha-value>)', foreground: 'rgb(var(--tlhp-c-accent-fg) / <alpha-value>)', text: 'rgb(var(--tlhp-c-accent-text) / <alpha-value>)', soft: 'rgb(var(--tlhp-c-accent-soft) / <alpha-value>)' },
        ceremonial: { DEFAULT: 'rgb(var(--tlhp-c-ceremonial) / <alpha-value>)', foreground: 'rgb(var(--tlhp-c-ceremonial-fg) / <alpha-value>)' },
        link: { DEFAULT: 'rgb(var(--tlhp-c-link) / <alpha-value>)', hover: 'rgb(var(--tlhp-c-link-hover) / <alpha-value>)' },
        border: { DEFAULT: 'rgb(var(--tlhp-c-border) / <alpha-value>)', strong: 'rgb(var(--tlhp-c-border-strong) / <alpha-value>)' },
        ornament: 'rgb(var(--tlhp-c-ornament) / <alpha-value>)',
        ring: 'rgb(var(--tlhp-c-ring) / <alpha-value>)',
        scrim: 'rgb(var(--tlhp-c-scrim) / <alpha-value>)',

        // ── Trạng thái in-line (không toast) ──
        success: { DEFAULT: 'rgb(var(--tlhp-c-success-fg) / <alpha-value>)', bg: 'rgb(var(--tlhp-c-success-bg) / <alpha-value>)', border: 'rgb(var(--tlhp-c-success-border) / <alpha-value>)', solid: 'rgb(var(--tlhp-c-success-solid) / <alpha-value>)' },
        warning: { DEFAULT: 'rgb(var(--tlhp-c-warning-fg) / <alpha-value>)', bg: 'rgb(var(--tlhp-c-warning-bg) / <alpha-value>)', border: 'rgb(var(--tlhp-c-warning-border) / <alpha-value>)', solid: 'rgb(var(--tlhp-c-warning-solid) / <alpha-value>)' },
        error: { DEFAULT: 'rgb(var(--tlhp-c-error-fg) / <alpha-value>)', bg: 'rgb(var(--tlhp-c-error-bg) / <alpha-value>)', border: 'rgb(var(--tlhp-c-error-border) / <alpha-value>)', solid: 'rgb(var(--tlhp-c-error-solid) / <alpha-value>)' },
        info: { DEFAULT: 'rgb(var(--tlhp-c-info-fg) / <alpha-value>)', bg: 'rgb(var(--tlhp-c-info-bg) / <alpha-value>)', border: 'rgb(var(--tlhp-c-info-border) / <alpha-value>)', solid: 'rgb(var(--tlhp-c-info-solid) / <alpha-value>)' },
      },

      fontFamily: {
        serif: ['var(--tlhp-font-serif)'],
        sans: ['var(--tlhp-font-sans)'],
        mono: ['var(--tlhp-font-mono)'],
      },

      // [cỡ, { lineHeight, letterSpacing, fontWeight }] — cỡ chữ co giãn 375px → 1320px
      fontSize: {
        display: ['clamp(2.75rem, 1.8571rem + 3.8095vw, 5rem)', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }], // 44→80px · Hero trang chủ ("Nơi để trở về"), tên đại lễ
        h1: ['clamp(2.25rem, 1.6548rem + 2.5397vw, 3.75rem)', { lineHeight: '1.2', letterSpacing: '-0.005em', fontWeight: '600' }], // 36→60px · Tiêu đề trang, tên khóa tu lớn
        h2: ['clamp(1.875rem, 1.4286rem + 1.9048vw, 3rem)', { lineHeight: '1.25', letterSpacing: '0', fontWeight: '600' }], // 30→48px · Tiêu đề phân mục, "Lịch tu học"
        h3: ['clamp(1.5rem, 1.3016rem + 0.8466vw, 2rem)', { lineHeight: '1.3', letterSpacing: '0', fontWeight: '600' }], // 24→32px · Tiêu đề bài viết, khối nổi bật
        h4: ['clamp(1.25rem, 1.1508rem + 0.4233vw, 1.5rem)', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }], // 20→24px · Tiêu đề thẻ khóa tu / bài viết
        title: ['clamp(1.125rem, 1.0754rem + 0.2116vw, 1.25rem)', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '600' }], // 18→20px · Tiêu đề cột footer, nhãn khối, tiêu đề nhỏ giao diện
        scripture: ['clamp(1.1875rem, 1.1379rem + 0.2116vw, 1.3125rem)', { lineHeight: '1.85', letterSpacing: '0.005em', fontWeight: '400' }], // 19→21px · Kinh văn, câu kệ, lời Thầy dạy
        'body-lg': ['clamp(1.125rem, 1.0754rem + 0.2116vw, 1.25rem)', { lineHeight: '1.8', letterSpacing: '0', fontWeight: '400' }], // 18→20px · Bài pháp thoại, nội dung dài
        body: ['clamp(1.0625rem, 1.0377rem + 0.1058vw, 1.125rem)', { lineHeight: '1.7', letterSpacing: '0', fontWeight: '400' }], // 17→18px · Nội dung mặc định
        'body-sm': ['1rem', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }], // 16px · Mô tả thẻ, chữ phụ giao diện (mức nhỏ nhất cho đoạn văn)
        caption: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }], // 14px · Ngày đăng, lượt xem, chú thích ảnh (không dùng cho đoạn văn)
        overline: ['0.875rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }], // 14px · Kicker/chip trên tiêu đề section (kiểu sub-title Bexon)
        button: ['1rem', { lineHeight: '1.25', letterSpacing: '0.01em', fontWeight: '600' }], // 16px · Chữ nút, viết hoa đầu câu (không in hoa toàn bộ)
        nav: ['1rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '500' }], // 16px · Mục menu chính
        label: ['1rem', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }], // 16px · Nhãn trường biểu mẫu (luôn hiển thị)
      },

      borderRadius: {
        none: '0', // Ảnh tràn viền
        xs: '4px', // Chip kicker, tag, badge (Bexon sub-title)
        sm: '6px', // Checkbox, ô lịch
        md: '10px', // Input, select, thẻ nhỏ
        lg: '12px', // Thẻ khóa tu/bài viết (Bexon card)
        xl: '16px', // Section inset, hero, footer (Bexon slider)
        pill: '9999px', // Nút bấm, pill lọc (Bexon button)
      },

      boxShadow: {
        xs: '0 1px 2px 0 rgb(44 28 17 / 0.06)', // Input, thẻ tĩnh khi cần tách nền
        sm: '0 2px 6px -1px rgb(44 28 17 / 0.08)', // Thẻ khi hover
        md: '0 10px 30px -12px rgb(44 28 17 / 0.18)', // Header dính khi cuộn
        lg: '0 24px 48px -20px rgb(44 28 17 / 0.22)', // Ảnh lightbox (do người dùng mở)
        focus: '0 0 0 2px rgb(var(--tlhp-c-bg)), 0 0 0 4px rgb(var(--tlhp-c-ring))', // Vòng focus kép – hiện trên mọi nền
      },

      spacing: {
        'section-y': 'var(--tlhp-section-y)',
        'section-inset': 'var(--tlhp-section-inset)',
        'card': 'var(--tlhp-card-pad)',
        'card-lg': 'var(--tlhp-card-pad-lg)',
        'gutter': 'var(--tlhp-gutter)',
        'header': 'var(--tlhp-header-h)',
        'touch': '48px',
      },
      gap: { grid: 'var(--tlhp-grid-gap)' },
      maxWidth: { container: '1320px', reading: '720px' },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
      height: { header: 'var(--tlhp-header-h)', announcement: '48px', logo: 'var(--tlhp-logo-h)' },
      aspectRatio: { hero: '16 / 9', event: '16 / 9', article: '4 / 3', portrait: '3 / 4', square: '1 / 1' },
      // đọc biến CSS để prefers-reduced-motion trong tokens.css tự đưa về 0ms
      transitionDuration: { instant: 'var(--tlhp-duration-instant)', fast: 'var(--tlhp-duration-fast)', base: 'var(--tlhp-duration-base)', slow: 'var(--tlhp-duration-slow)' },
      transitionTimingFunction: { calm: 'cubic-bezier(0.25, 0.1, 0.25, 1)', out: 'cubic-bezier(0.22, 0.61, 0.36, 1)', 'in-out': 'cubic-bezier(0.45, 0, 0.55, 1)' },
      zIndex: { base: '0', raised: '10', sticky: '40', dropdown: '50', lightbox: '60' },
    },
  },
  plugins: [],
};
