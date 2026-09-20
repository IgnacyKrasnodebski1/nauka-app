import React, { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/lib/motion";
import { COLORS, PLAY, RADIUS, display } from "@/lib/theme";
import { Icon, type IoniconName } from "./Icon";

export type SwipeDir = "left" | "right" | "up";

export interface SwipeDeckHandle {
  /** programowy swipe (przyciski pod stosem) */
  swipe(dir: SwipeDir): void;
}

interface Props<T> {
  items: T[];
  index: number;
  renderCard: (item: T, i: number, top: boolean) => React.ReactNode;
  onSwipe: (dir: SwipeDir, item: T, i: number) => void;
  keyOf?: (item: T, i: number) => string;
  labels?: Partial<Record<SwipeDir, string>>;
  colors?: Partial<Record<SwipeDir, string>>;
  icons?: Partial<Record<SwipeDir, IoniconName>>;
  allowUp?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_COLORS: Record<SwipeDir, string> = { left: PLAY.red, right: PLAY.green, up: PLAY.blue };
const DEFAULT_ICONS: Record<SwipeDir, IoniconName> = { left: "close", right: "checkmark", up: "flash" };

/**
 * Stos 3 kart z gestem swipe (gesture-handler Pan + Reanimated): przeciąganie obraca kartę, nakładka tintu
 * rośnie z odległością; po przekroczeniu progu karta wylatuje i woła `onSwipe`. Tapy przechodzą do karty (flip).
 */
function SwipeDeckInner<T>({ items, index, renderCard, onSwipe, keyOf, labels, colors, icons, allowUp = true, style }: Props<T>, ref: React.Ref<SwipeDeckHandle>) {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const busy = useSharedValue(false);
  const threshold = Math.min(120, width * 0.3);
  const cs = { ...DEFAULT_COLORS, ...(colors ?? {}) };
  const ic = { ...DEFAULT_ICONS, ...(icons ?? {}) };

  const item = items[index];
  const done = (dir: SwipeDir) => {
    if (item === undefined) return;
    onSwipe(dir, item, index);
    x.set(0);
    y.set(0);
    busy.set(false);
  };

  const flyOut = (dir: SwipeDir) => {
    "worklet";
    busy.set(true);
    const dur = reduce ? 0 : 260;
    if (dir === "up") {
      y.set(withTiming(-900, { duration: dur }, () => runOnJS(done)(dir)));
    } else {
      x.set(withTiming(dir === "right" ? width * 1.4 : -width * 1.4, { duration: dur }, () => runOnJS(done)(dir)));
    }
  };

  useImperativeHandle(ref, () => ({
    swipe(dir) {
      if (item === undefined) return;
      if (reduce) done(dir);
      else flyOut(dir);
    },
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .activeOffsetY(allowUp ? [-18, 18] : [-10000, 10000])
    .onUpdate((e) => {
      if (busy.value) return;
      x.set(e.translationX);
      y.set(allowUp ? e.translationY : e.translationY * 0.15);
    })
    .onEnd((e) => {
      if (busy.value) return;
      const vx = e.velocityX,
        vy = e.velocityY;
      if (allowUp && (y.value < -threshold || vy < -900) && Math.abs(x.value) < threshold * 0.8) return flyOut("up");
      if (x.value > threshold || vx > 800) return flyOut("right");
      if (x.value < -threshold || vx < -800) return flyOut("left");
      x.set(withSpring(0, { damping: 16, stiffness: 220 }));
      y.set(withSpring(0, { damping: 16, stiffness: 220 }));
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${(x.value / width) * 14}deg` }],
  }));
  const rightTint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, threshold], [0, 0.85], Extrapolation.CLAMP) }));
  const leftTint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-threshold, 0], [0.85, 0], Extrapolation.CLAMP) }));
  const upTint = useAnimatedStyle(() => ({ opacity: allowUp ? interpolate(y.value, [-threshold, 0], [0.85, 0], Extrapolation.CLAMP) : 0 }));
  const second = useAnimatedStyle(() => {
    const k = Math.min(1, (Math.abs(x.value) + Math.abs(y.value)) / threshold);
    return { transform: [{ scale: 0.95 + k * 0.05 }, { translateY: 12 - k * 12 }] };
  });
  const third = useAnimatedStyle(() => {
    const k = Math.min(1, (Math.abs(x.value) + Math.abs(y.value)) / threshold);
    return { transform: [{ scale: 0.9 + k * 0.05 }, { translateY: 24 - k * 12 }] };
  });

  const k = (i: number) => (items[i] !== undefined ? (keyOf ? keyOf(items[i]!, i) : String(i)) : `e${i}`);

  return (
    <View style={[s.wrap, style]}>
      {items[index + 2] !== undefined ? (
        <Animated.View key={k(index + 2)} style={[StyleSheet.absoluteFill, third]} pointerEvents="none">
          {renderCard(items[index + 2]!, index + 2, false)}
        </Animated.View>
      ) : null}
      {items[index + 1] !== undefined ? (
        <Animated.View key={k(index + 1)} style={[StyleSheet.absoluteFill, second]} pointerEvents="none">
          {renderCard(items[index + 1]!, index + 1, false)}
        </Animated.View>
      ) : null}
      {item !== undefined ? (
        <GestureDetector gesture={pan}>
          <Animated.View key={k(index)} style={[StyleSheet.absoluteFill, topStyle]}>
            {renderCard(item, index, true)}
            <Animated.View pointerEvents="none" style={[s.tint, { backgroundColor: cs.right }, rightTint]}>
              <Badge color={cs.right} icon={ic.right} label={labels?.right} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[s.tint, { backgroundColor: cs.left }, leftTint]}>
              <Badge color={cs.left} icon={ic.left} label={labels?.left} />
            </Animated.View>
            {allowUp ? (
              <Animated.View pointerEvents="none" style={[s.tint, { backgroundColor: cs.up }, upTint]}>
                <Badge color={cs.up} icon={ic.up} label={labels?.up} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

function Badge({ color, icon, label }: { color: string; icon: IoniconName; label?: string }) {
  return (
    <View style={s.badge}>
      <View style={[s.badgeIcon, { borderColor: "#fff" }]}>
        <Icon name={icon} size={36} color="#fff" />
      </View>
      {label ? <Animated.Text style={[s.badgeTxt, { color: "#fff" }]}>{label}</Animated.Text> : null}
      <View style={{ display: "none", backgroundColor: color }} />
    </View>
  );
}

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T>(p: Props<T> & { ref?: React.Ref<SwipeDeckHandle> }) => React.ReactElement;

const s = StyleSheet.create({
  wrap: { flex: 1, minHeight: 280 },
  tint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" },
  badge: { alignItems: "center", gap: 8 },
  badgeIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
  badgeTxt: { fontFamily: display(800), fontSize: 22, textTransform: "uppercase", letterSpacing: 1, textShadowColor: "rgba(0,0,0,0.3)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 }, color: COLORS.text },
});
