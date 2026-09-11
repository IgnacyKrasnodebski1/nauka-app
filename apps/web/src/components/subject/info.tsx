import type { AppSubject } from "@/lib/types";

export function InfoTab({ subject }: { subject: AppSubject }) {
  return (
    <div className="pb-8">
      <div className="hero !pb-2">
        <h1>{subject.emoji} {subject.name}</h1>
        <p>{subject.tagline}</p>
      </div>
      {subject.info ? (
        <div dangerouslySetInnerHTML={{ __html: subject.info }} />
      ) : (
        <div className="zbox"><p>Brak dodatkowych informacji.</p></div>
      )}
      <div className="zbox">
        <h3>Siatka ocen</h3>
        <table className="gradetbl">
          <tbody>
            {[...subject.grading.scale].sort((a, b) => a[0] - b[0]).map(([thr, label]) => (
              <tr key={label}><td>od {thr}%</td><td>{label}</td></tr>
            ))}
            <tr><td>poniżej {Math.min(...subject.grading.scale.map((s) => s[0]))}%</td><td>{subject.grading.failLabel}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
