import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1B4CE0",
          700: "#163CB4",
          600: "#1B4CE0",
          500: "#3B66EE",
          50: "#EEF2FF",
          100: "#DDE5FF",
        },
        ink: {
          DEFAULT: "#0F172A",
          2: "#334155",
          muted: "#64748B",
          faint: "#94A3B8",
        },
        canvas: "#F2F4F8",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Pretendard",
          "Pretendard Variable",
          "Noto Sans KR",
          "Malgun Gothic",
          "맑은 고딕",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "D2Coding",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.18)",
        sheet: "0 24px 48px -24px rgba(15,23,42,.35)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pop: "pop .32s cubic-bezier(.2,1.4,.4,1)",
        rise: "rise .24s ease",
      },
    },
  },
  plugins: [],
};

export default config;
