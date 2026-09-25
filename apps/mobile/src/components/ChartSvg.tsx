import React from "react";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { T, body } from "@/lib/theme";

/** Wykres słupkowy / liniowy (ChartRead.html, legacy `chartSvg`): jedna seria, wartości nad znacznikami, etykiety pod osią. */
export function ChartSvg({ kind, xs, ys, fmt = (v) => String(v), color = T.violet }: { kind: "bar" | "line"; xs: string[]; ys: number[]; fmt?: (v: number) => string; color?: string }) {
  const W = 330,
    H = 178,
    top = 22,
    base = 150,
    left = 14,
    right = 320;
  const n = Math.max(1, xs.length);
  const max = Math.max(1e-9, ...ys);
  const step = (right - left) / n;
  const yOf = (v: number) => base - (Math.max(0, v) / max) * (base - top);
  const xOf = (i: number) => left + step * i + step / 2;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const bw = Math.min(34, step * 0.66);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`${kind === "line" ? "Wykres liniowy" : "Wykres słupkowy"}: ${xs.map((x, i) => `${x}: ${fmt(ys[i] ?? 0)}`).join(", ")}`}>
      {[0.5, 1].map((f) => (
        <Line key={f} x1={left - 4} y1={r1(yOf(max * f))} x2={right + 5} y2={r1(yOf(max * f))} stroke={T.line2} strokeWidth={2} strokeDasharray="4 6" />
      ))}
      <Line x1={left - 4} y1={base} x2={right + 5} y2={base} stroke={T.line} strokeWidth={2} />
      {kind === "line" ? (
        <>
          <Polyline points={ys.map((v, i) => `${r1(xOf(i))},${r1(yOf(v))}`).join(" ")} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          {ys.map((v, i) => (
            <React.Fragment key={i}>
              <Circle cx={r1(xOf(i))} cy={r1(yOf(v))} r={5} fill={T.surface} stroke={color} strokeWidth={3} />
              <SvgText x={r1(xOf(i))} y={r1(yOf(v)) - 11} textAnchor="middle" fill={T.txt} fontSize={12} fontFamily={body(800)}>
                {fmt(v)}
              </SvgText>
            </React.Fragment>
          ))}
        </>
      ) : (
        ys.map((v, i) => (
          <React.Fragment key={i}>
            <Rect x={r1(xOf(i) - bw / 2)} y={r1(yOf(v))} width={r1(bw)} height={r1(base - yOf(v))} rx={7} fill={color} />
            <SvgText x={r1(xOf(i))} y={r1(yOf(v)) - 7} textAnchor="middle" fill={T.txt} fontSize={12} fontFamily={body(800)}>
              {fmt(v)}
            </SvgText>
          </React.Fragment>
        ))
      )}
      {xs.map((x, i) => (
        <SvgText key={i} x={r1(xOf(i))} y={base + 20} textAnchor="middle" fill={T.muted} fontSize={11.5} fontFamily={body(700)}>
          {x}
        </SvgText>
      ))}
    </Svg>
  );
}
