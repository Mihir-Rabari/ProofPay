import { ReactNode, useEffect } from "react";
import { Animated, Pressable, StyleSheet, Text, useAnimatedValue, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

export const C = { ink: "#26342b", muted: "#7f887c", forest: "#31563f", sage: "#738a69", line: "#e4e8df", paper: "#f5f6f1", white: "#fff", pale: "#edf3e9", gold: "#cbb879", red: "#a35e53" };
export const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: C.paper }, safe: { flex: 1, paddingHorizontal: 22 }, eyebrow: { color: C.sage, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 }, title: { color: C.ink, fontSize: 31, lineHeight: 37, fontWeight: "700", letterSpacing: -1.2 }, body: { color: C.muted, fontSize: 13, lineHeight: 20 }, card: { backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16 }, row: { flexDirection: "row", alignItems: "center", gap: 10 }, between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, field: { height: 50, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.white, paddingHorizontal: 14, color: C.ink, fontSize: 14 }, primary: { height: 52, borderRadius: 10, backgroundColor: C.forest, alignItems: "center", justifyContent: "center" }, error: { color: C.red, fontSize: 12, lineHeight: 18 }, badge: { backgroundColor: C.pale, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 } });

export function Brand({ light = false }: { light?: boolean }) { return <View style={styles.row}><View style={ui.mark}><View style={ui.markDot}/></View><Text style={{ color: light ? "#fff" : C.ink, fontSize: 19, fontWeight: "800", letterSpacing: -1 }}>proofpay</Text></View>; }

export function Button({ title, onPress, disabled, secondary, style }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; style?: ViewStyle }) {
  const scale = useAnimatedValue(1);
  return <Pressable disabled={disabled} onPressIn={() => Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 30, bounciness: 2 }).start()} onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 5 }).start()} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}><Animated.View style={[secondary ? ui.secondary : ui.button, style, disabled && { opacity: .55 }, { transform: [{ scale }] }]}><Text style={secondary ? ui.secondaryText : ui.buttonText}>{title}</Text></Animated.View></Pressable>;
}

export function Enter({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const opacity = useAnimatedValue(0);
  const y = useAnimatedValue(12);
  useEffect(() => { Animated.parallel([Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }), Animated.spring(y, { toValue: 0, delay, useNativeDriver: true, damping: 18, stiffness: 100 })]).start(); }, [delay, opacity, y]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

export function WordmarkHeader({ right }: { right?: ReactNode }) { return <View style={[styles.between, { paddingTop: 12, paddingBottom: 22 }]}><Brand/>{right}</View>; }

const ui = StyleSheet.create({ mark: { width: 27, height: 27, borderRadius: 8, backgroundColor: C.forest, alignItems: "center", justifyContent: "center" }, markDot: { width: 10, height: 10, borderRadius: 4, backgroundColor: "#d1deb8", transform: [{ rotate: "-20deg" }] }, button: { minHeight: 52, borderRadius: 10, backgroundColor: C.forest, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", shadowColor: C.forest, shadowOpacity: .15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 }, secondary: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, secondaryText: { color: C.forest, fontSize: 13, fontWeight: "700" } });
