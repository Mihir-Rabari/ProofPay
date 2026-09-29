import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSession } from "../api";
import { Button, C, Enter, styles, WordmarkHeader } from "../ui";

export default function SignInScreen() {
  const { actor, loading, login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (actor) return <Redirect href="/projects"/>;

  async function submit() {
    setBusy(true); setError("");
    try { await login(email.trim(), password); router.replace("/projects"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not sign in. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (loading) return <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator color={C.forest}/></View>;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}><StatusBar style="dark"/><ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"><View style={[styles.safe, { paddingTop: 16, paddingBottom: 34 }]}>
    <WordmarkHeader right={<Text style={{ color: C.muted, fontSize: 11 }}>FIELD APP</Text>}/>
    <Enter style={{ marginTop: 16 }}><View style={{ backgroundColor: "#304c38", borderRadius: 19, padding: 24, minHeight: 205, justifyContent: "space-between", overflow: "hidden" }}><View><Text style={{ color: "#cfdfbd", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>PROOF THAT TRAVELS FURTHER</Text><Text style={{ color: "#fff", fontSize: 36, lineHeight: 40, letterSpacing: -1.8, fontWeight: "700", marginTop: 15 }}>Good work{ "\n" }deserves to be seen.</Text></View><Text style={{ color: "#dae2d4", fontSize: 12 }}>Evidence from the field, connected to real milestones.</Text><View style={{ position: "absolute", width: 190, height: 190, borderColor: "#ffffff12", borderWidth: 1, borderRadius: 100, right: -75, bottom: -90 }}/></View></Enter>
    <Enter delay={90} style={{ marginTop: 28 }}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={[styles.title, { marginTop: 8 }]}>Your work, in view.</Text><Text style={[styles.body, { marginTop: 7, marginBottom: 22 }]}>Sign in to continue to your ProofPay workspace.</Text>
      <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12, marginBottom: 7 }}>Email address</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@organization.org" placeholderTextColor="#a5aba1" value={email} onChangeText={setEmail} style={styles.field}/>
      <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12, marginTop: 17, marginBottom: 7 }}>Password</Text><TextInput autoCapitalize="none" autoComplete="password" textContentType="password" secureTextEntry placeholder="Your password" placeholderTextColor="#a5aba1" value={password} onChangeText={setPassword} onSubmitEditing={submit} style={styles.field}/>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { marginTop: 12 }]}>{error}</Text> : null}
      <View style={{ marginTop: 22 }}><Button title={busy ? "Signing in…" : "Sign in securely"} onPress={submit} disabled={busy || !email || !password}/></View>
      <Text style={{ marginTop: 16, textAlign: "center", color: C.muted, fontSize: 10, lineHeight: 16 }}>New to ProofPay? Create your workspace in the web app first.</Text>
    </Enter>
    <View style={{ flex: 1, minHeight: 22 }}/><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 26 }}><Text style={{ color: C.sage, fontSize: 11 }}>◈</Text><Text style={{ color: C.muted, fontSize: 10 }}>Session token is stored securely on this device.</Text></View>
  </View></ScrollView></KeyboardAvoidingView>;
}
