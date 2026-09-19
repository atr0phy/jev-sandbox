type SoupArtProps = { small?: boolean };

export const SoupArt = ({ small = false }: SoupArtProps) => {
  return (
    <svg
      className={small ? 'soup-mark' : 'soup-art'}
      viewBox="0 0 240 200"
      fill="none"
      aria-hidden="true"
    >
      <path d="M20 102C20 102 27 177 120 177C213 177 220 102" fill="currentColor" opacity=".12" />
      <ellipse cx="120" cy="102" rx="100" ry="33" stroke="currentColor" strokeWidth="3" />
      <ellipse
        cx="120"
        cy="102"
        rx="72"
        ry="19"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".45"
      />
      <path
        d="M20 102C25 151 60 177 120 177C180 177 215 151 220 102M91 183H149"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M84 56C67 39 98 34 85 14M122 54C104 36 136 29 123 8M158 56C143 42 169 33 157 19"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="87" cy="102" r="5" fill="#c96444" />
      <circle cx="145" cy="94" r="7" fill="#c96444" />
      <path d="M112 103L120 110L111 115L103 108Z" fill="currentColor" opacity=".6" />
    </svg>
  );
};
