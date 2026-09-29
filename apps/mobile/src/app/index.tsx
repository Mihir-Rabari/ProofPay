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
    <WordmarkHeader/>
    <Enter style={{ marginTop: 28 }}><Text style={styles.title}>Sign in</Text>
      <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12, marginBottom: 7 }}>Email address</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@organization.org" placeholderTextColor="#a5aba1" value={email} onChangeText={setEmail} style={styles.field}/>
      <Text style={{ color: C.ink, fontWeight: "600", fontSize: 12, marginTop: 17, marginBottom: 7 }}>Password</Text><TextInput autoCapitalize="none" autoComplete="password" textContentType="password" secureTextEntry placeholder="Your password" placeholderTextColor="#a5aba1" value={password} onChangeText={setPassword} onSubmitEditing={submit} style={styles.field}/>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { marginTop: 12 }]}>{error}</Text> : null}
      <View style={{ marginTop: 22 }}><Button title={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy || !email || !password}/></View>
      <Text style={{ marginTop: 16, textAlign: "center", color: C.muted, fontSize: 11, lineHeight: 17 }}>Create an account on the ProofPay website to get started.</Text>
    </Enter>
    <View style={{ flex: 1, minHeight: 22 }}/>
  </View></ScrollView></KeyboardAvoidingView>;
}
