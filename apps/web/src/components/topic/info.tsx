import type { Topic } from "@nauka/shared";

export function InfoTab({ topic }: { topic: Topic }) {
  return (
    <div className="pb-8">
      <div className="hero !pb-2">
        <h1>{topic.emoji} {topic.name}</h1>
        <p>{topic.tagline}</p>
      </div>
      <div className="text-muted text-xs mb-3">źródło: {topic.source === "prompt" ? "✍️ z hasła (podstawa programowa)" : "📸 z Twoich materiałów"}</div>
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
