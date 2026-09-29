import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../api";

export default function RootLayout() {
  return <SessionProvider><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom", contentStyle: { backgroundColor: "#f5f6f1" } }}/></SessionProvider>;
}
