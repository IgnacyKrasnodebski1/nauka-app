import type { Topic } from "@nauka/shared";

export function InfoTab({ topic }: { topic: Topic }) {
  return (
    <div className="pb-8">
      <div className="hero !pb-3">
        <p className="!mt-0 !text-[15px] !text-[var(--text-soft)]">{topic.tagline}</p>
        <div className="eyebrow mt-3">źródło: {topic.source === "prompt" ? "hasło (podstawa programowa)" : "Twoje materiały"}</div>
      </div>
      {topic.info ? <div dangerouslySetInnerHTML={{ __html: topic.info }} /> : <div className="zbox"><p>Brak dodatkowych informacji.</p></div>}
      <div className="zbox">
        <h3>Siatka ocen</h3>
        <table className="gradetbl">
          <tbody>
            {[...topic.grading.scale].sort((a, b) => a[0] - b[0]).map(([thr, label]) => (
              <tr key={label}><td>od {thr}%</td><td>{label}</td></tr>
            ))}
            <tr><td>poniżej {Math.min(...topic.grading.scale.map((s) => s[0]))}%</td><td>{topic.grading.failLabel}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
