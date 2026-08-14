export function LoginHero() {
  return (
    <aside className="login-hero relative flex flex-col justify-between overflow-hidden px-8 py-10 sm:px-12 sm:py-12 lg:min-h-screen lg:w-[48%] lg:max-w-[640px] lg:shrink-0">
      <div className="login-hero__brand relative z-10">
        <div className="flex items-center gap-2 text-white/95">
          <span className="login-hero__logo-grid" aria-hidden />
          <span className="text-xl font-bold tracking-wide">Hanki</span>
        </div>
        <h1 className="mt-8 text-3xl sm:text-4xl font-bold text-white leading-tight max-w-md">
          Hanki Chào mừng bạn!{" "}
          <span className="block mt-1 text-2xl sm:text-3xl font-semibold opacity-95">欢迎你</span>
        </h1>
      </div>

      <div className="login-hero__art relative z-10 flex-1 flex items-end justify-center lg:justify-start pb-4 pt-8 min-h-[220px] lg:min-h-0">
        <svg
          className="w-full max-w-[420px] h-auto drop-shadow-lg"
          viewBox="0 0 420 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <ellipse cx="210" cy="290" rx="180" ry="24" fill="rgba(255,255,255,0.15)" />
          <path
            d="M60 200 Q90 160 120 200 T180 200 T240 200 T300 200 T360 200"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="3"
            fill="none"
          />
          <ellipse cx="100" cy="195" rx="38" ry="22" fill="rgba(255,255,255,0.25)" />
          <ellipse cx="320" cy="185" rx="48" ry="26" fill="rgba(255,255,255,0.2)" />
          <ellipse cx="220" cy="175" rx="55" ry="28" fill="rgba(255,255,255,0.28)" />
          <path
            d="M210 80 L250 110 L250 200 L170 200 L170 110 Z"
            fill="#F5B942"
            stroke="#E8A832"
            strokeWidth="2"
          />
          <path d="M170 110 L210 80 L250 110 L210 95 Z" fill="#4A90D9" />
          <path d="M185 110 L185 200 L235 200 L235 110 Z" fill="#5BA3E8" opacity="0.85" />
          <rect x="198" y="130" width="24" height="50" rx="2" fill="#F5B942" />
          <path d="M155 200 L265 200 L275 210 L145 210 Z" fill="#E8943A" />
          <path d="M140 210 L280 210 L285 218 L135 218 Z" fill="#D4782A" />
          <circle cx="130" cy="250" r="28" fill="#FF8C42" opacity="0.9" />
          <circle cx="165" cy="265" r="22" fill="#FFB347" opacity="0.85" />
          <circle cx="290" cy="255" r="32" fill="#FF7B3A" opacity="0.88" />
          <circle cx="250" cy="270" r="18" fill="#FFA05C" />
          <path
            d="M120 248 Q130 230 140 248 Q130 255 120 248"
            fill="#FF6B35"
            opacity="0.7"
          />
          <path
            d="M275 242 Q288 222 302 242 Q288 252 275 242"
            fill="#FF6B35"
            opacity="0.7"
          />
        </svg>
      </div>
    </aside>
  );
}
