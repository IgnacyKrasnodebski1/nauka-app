import { MASCOT, MASCOT_LINES, MASCOT_STATES, plumeForStreak, type MascotState } from "@nauka/shared";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, MOTION, RADIUS, SPACE, body, display } from "@/lib/theme";

let uid = 0;

/**
 * „Rec” — maskotka: świecąca kulka-wspomnienie z oczami, policzkami i płomykiem, który rośnie ze streakiem.
 * Geometria z shared/mascot.ts. Ruch: bob/bounce/jump/droop (Reanimated), mruganie w pętli, migoczący płomyk, zzz przy śnie.
 * Reduce Motion → statyczna.
 */
export function Mascot({ state = "idle", size = 120, streak = 0, style }: { state?: MascotState; size?: number; streak?: number; style?: StyleProp<ViewStyle> }) {
  const pose = MASCOT_STATES[state];
  const reduce = useReduceMotion();
  const ids = useMemo(() => {
    const n = ++uid;
    return { body: `mb${n}`, glow: `mg${n}`, plume: `mp${n}` };
  }, []);
  const [blink, setBlink] = useState(false);

  /* mruganie */
  useEffect(() => {
    if (reduce || pose.eyeOpen === 0) return;
    let t2: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      setBlink(true);
      t2 = setTimeout(() => setBlink(false), 130);
    }, 3200 + Math.round(Math.random() * 1800));
    return () => {
      clearInterval(t);
      if (t2) clearTimeout(t2);
    };
  }, [reduce, pose.eyeOpen]);

  /* ruch ciała */
  const y = useSharedValue(0);
  const sc = useSharedValue(1);
  const rot = useSharedValue(0);
  useEffect(() => {
    y.set(0);
    sc.set(1);
    rot.set(0);
    if (reduce) return;
    switch (pose.motion) {
      case "bob":
        y.set(withRepeat(withSequence(withTiming(-4, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1, false));
        break;
      case "bounce":
        sc.set(withSequence(withSpring(1.12, { damping: 6, stiffness: 260 }), withSpring(1, MOTION.spring)));
        y.set(withRepeat(withSequence(withTiming(-6, { duration: 500, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })), -1, false));
        break;
      case "jump":
        y.set(withRepeat(withSequence(withTiming(-16, { duration: 320, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 380, easing: Easing.bounce }), withDelay(700, withTiming(0, { duration: 1 }))), -1, false));
        rot.set(withRepeat(withSequence(withTiming(-6, { duration: 320 }), withTiming(6, { duration: 380 }), withTiming(0, { duration: 700 })), -1, false));
        break;
      case "droop":
        y.set(withTiming(6, { duration: 500 }));
        rot.set(withTiming(-5, { duration: 500 }));
        sc.set(withTiming(0.96, { duration: 500 }));
        break;
      case "none":
      default:
        break;
    }
  }, [pose.motion, reduce, y, sc, rot]);
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }] }));

  /* płomyk */
  const plumeScale = plumeForStreak(streak) * pose.plume;
  const fl = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    fl.set(withRepeat(withSequence(withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 460, easing: Easing.inOut(Easing.quad) })), -1, true));
  }, [fl, reduce]);
  const plumeStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - fl.value * 0.1 }, { scaleY: 1 + fl.value * 0.12 }] }));

  const eyeOpen = blink ? 0.08 : pose.eyeOpen;
  const ry = Math.max(0.8, MASCOT.eyeR.ry * eyeOpen);
  const mouthD = MASCOT.mouths[pose.mouth];
  const filledMouth = pose.mouth === "grin" || pose.mouth === "open";
  const brows = MASCOT.brows[pose.brow] as readonly string[] | null;
  const k = size / 120;
  // płomyk w osobnym Svg (viewBox 40..80 × 0..32), skalowany od podstawy [60,30]
  const plumeW = 40 * k;
  const plumeH = 32 * k;

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        {/* płomyk */}
        <Animated.View style={[{ position: "absolute", left: (60 - 20) * k, top: 0, width: plumeW, height: plumeH, transformOrigin: "50% 100%", transform: [{ scale: plumeScale }] }]}>
          <Animated.View style={[{ width: plumeW, height: plumeH, transformOrigin: "50% 100%" }, plumeStyle]}>
            <Svg width={plumeW} height={plumeH} viewBox="40 0 40 32">
              <Defs>
                <LinearGradient id={ids.plume} x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0" stopColor={MASCOT.colors.plume[1]} />
                  <Stop offset="1" stopColor={MASCOT.colors.plume[0]} />
                </LinearGradient>
              </Defs>
              <Path d={MASCOT.plume.d} fill={`url(#${ids.plume})`} />
              <Path d={MASCOT.plume.inner} fill="#FFF3C4" opacity={0.9} />
            </Svg>
          </Animated.View>
        </Animated.View>
        <Svg width={size} height={size} viewBox={MASCOT.viewBox}>
          <Defs>
            <RadialGradient id={ids.body} cx="42%" cy="36%" r="70%">
              <Stop offset="0" stopColor={MASCOT.colors.core} />
              <Stop offset="0.55" stopColor={MASCOT.colors.mid} />
              <Stop offset="1" stopColor={MASCOT.colors.edge} />
            </RadialGradient>
            <RadialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
              <Stop offset="0.6" stopColor={MASCOT.colors.glow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={MASCOT.colors.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* poświata */}
          <Circle cx={MASCOT.body.cx} cy={MASCOT.body.cy} r={MASCOT.body.r + 12} fill={`url(#${ids.glow})`} />
          {/* ciało */}
          <Circle cx={MASCOT.body.cx} cy={MASCOT.body.cy} r={MASCOT.body.r} fill={`url(#${ids.body})`} />
          <Ellipse cx={MASCOT.body.cx - 14} cy={MASCOT.body.cy - 22} rx={11} ry={6} fill="#fff" opacity={0.35} />
          {/* oczy */}
          {MASCOT.eyes.map((e, i) => (
            <G key={i}>
              <Ellipse cx={e.cx} cy={e.cy} rx={MASCOT.eyeR.rx} ry={ry} fill={MASCOT.colors.eye} />
              {eyeOpen > 0.15 ? (
                <>
                  <Circle cx={e.cx + pose.pupil[0]} cy={e.cy + pose.pupil[1]} r={MASCOT.pupilR} fill={MASCOT.colors.pupil} />
                  <Circle cx={e.cx + pose.pupil[0] + MASCOT.shine.dx} cy={e.cy + pose.pupil[1] + MASCOT.shine.dy} r={MASCOT.shine.r} fill="#fff" />
                </>
              ) : null}
            </G>
          ))}
          {/* brwi */}
          {brows ? brows.map((d, i) => <Path key={i} d={d} stroke={MASCOT.colors.mouth} strokeWidth={2.6} strokeLinecap="round" fill="none" />) : null}
          {/* policzki */}
          {MASCOT.cheeks.map((c, i) => (
            <Circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={MASCOT.colors.cheek} opacity={0.75} />
          ))}
          {/* usta */}
          {filledMouth ? <Path d={mouthD} fill={MASCOT.colors.mouth} /> : <Path d={mouthD} stroke={MASCOT.colors.mouth} strokeWidth={3} strokeLinecap="round" fill="none" />}
          {pose.mouth === "open" ? <Path d="M55 82 Q60 90 65 82 Z" fill="#FF86D0" opacity={0.8} /> : null}
          {/* kropla potu */}
          {pose.extras === "sweat" ? <Path d="M94 48 C90 54 90 58 94 58 C98 58 98 54 94 48 Z" fill="#7DE3F5" opacity={0.95} /> : null}
        </Svg>
      </Animated.View>
      {pose.extras === "zzz" ? <Zzz size={size} reduce={reduce} /> : null}
    </View>
  );
}

function Zzz({ size, reduce }: { size: number; reduce: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [v, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: reduce ? 1 : 1 - v.value, transform: [{ translateY: -v.value * 18 }, { translateX: v.value * 8 }] }));
  return (
    <Animated.Text style={[{ position: "absolute", right: size * 0.06, top: size * 0.12, fontFamily: display(800), color: COLORS.textSoft, fontSize: Math.round(size * 0.16) }, st]}>
      z z z
    </Animated.Text>
  );
}

/** Dymek maskotki z linią z MASCOT_LINES (albo własnym tekstem). */
export function MascotBubble({ state = "idle", text, seed = 0, style, tail = "left" }: { state?: MascotState; text?: string; seed?: number; style?: StyleProp<ViewStyle>; tail?: "left" | "bottom" }) {
  const line = text ?? MASCOT_LINES[state][seed % MASCOT_LINES[state].length]!;
  return (
    <View style={[s.bubble, style]}>
      <Text style={s.bubbleTxt}>{line}</Text>
      <View style={[s.tail, tail === "left" ? s.tailLeft : s.tailBottom]} />
    </View>
  );
}

const s = StyleSheet.create({
  bubble: { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: RADIUS.md, paddingVertical: SPACE[3], paddingHorizontal: SPACE[4], maxWidth: 260 },
  bubbleTxt: { color: COLORS.text, fontFamily: body(600), fontSize: 15, lineHeight: 21 },
  tail: { position: "absolute", width: 12, height: 12, backgroundColor: COLORS.bg3, borderColor: COLORS.lineStrong, transform: [{ rotate: "45deg" }] },
  tailLeft: { left: -7, top: 18, borderLeftWidth: 1, borderBottomWidth: 1 },
  tailBottom: { bottom: -7, left: 24, borderRightWidth: 1, borderBottomWidth: 1 },
});
