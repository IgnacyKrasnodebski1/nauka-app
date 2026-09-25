/** CSS confetti (legacy confetti(n)): n pieces .a-fall with delays d1…d6, colours only from tokens via --c. */
const CONF = ["pink", "cyan", "gold", "acid"];
export function Confetti({ n = 6 }: { n?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={`a-fall${i % 7 ? " d" + (i % 7) : ""}${i % 3 === 1 ? " round" : ""}`} style={{ left: `${(i * 37 + 11) % 92}%`, top: `${(i * 53 + 40) % 300}px`, ["--c" as string]: `var(--${CONF[i % 4]})`, ["--s" as string]: `${7 + ((i * 5) % 7)}px` }} />
      ))}
    </div>
  );
}
