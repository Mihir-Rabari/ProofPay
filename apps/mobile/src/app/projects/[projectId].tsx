import * as ImagePicker from "expo-image-picker";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { apiBase, Asset, Project, useSession } from "../../api";
import { C, Enter, styles, WordmarkHeader, Button } from "../../ui";

const inr = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { actor, loading, api, getToken } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const router = useRouter();
  const membership = actor?.memberships.find(m => m.organizationId === project?.organizationId);
  const canSubmit = ["FUNDER", "NGO_ADMIN", "FIELD_WORKER"].includes(membership?.role ?? "");
  const canReview = membership?.role === "REVIEWER";
  const load = useCallback(async () => {
    setError("");
    try {
      const [projectData, evidenceData] = await Promise.all([api<{ projects: Project[] }>("/api/projects"), api<{ assets: Asset[]; milestones: { id: string; title: string }[] }>(`/api/projects/${projectId}/assets`)]);
      const found = projectData.projects.find(item => item.id === projectId);
      if (!found) throw new Error("This project is not available to your workspace.");
      setProject(found); setAssets(evidenceData.assets); setSelectedMilestone(current => evidenceData.milestones.some(item => item.id === current) ? current : evidenceData.milestones[0]?.id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open this project."); }
  }, [api, projectId]);
  useEffect(() => {
    if (!actor) return;
    let active = true;
    getToken().then(token => { if (active) setSessionToken(token ?? ""); });
    Promise.all([
      api<{ projects: Project[] }>("/api/projects"),
      api<{ assets: Asset[]; milestones: { id: string; title: string }[] }>(`/api/projects/${projectId}/assets`),
    ]).then(([projectData, evidenceData]) => {
      if (!active) return;
      const found = projectData.projects.find(item => item.id === projectId);
      if (!found) throw new Error("This project is not available to your workspace.");
      setProject(found); setAssets(evidenceData.assets); setSelectedMilestone(current => evidenceData.milestones.some(item => item.id === current) ? current : evidenceData.milestones[0]?.id ?? "");
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not open this project."); });
    return () => { active = false; };
  }, [actor, api, getToken, projectId]);
  if (!loading && !actor) return <Redirect href="/"/>;

  async function uploadEvidence() {
    if (!project || !selectedMilestone || !canSubmit) return;
    const picker = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
    if (picker.canceled || !picker.assets[0]) return;
    const photo = picker.assets[0];
    const body = new FormData();
    body.append("file", { uri: photo.uri, name: photo.fileName ?? `field-proof-${Date.now()}.jpg`, type: photo.mimeType ?? "image/jpeg" } as unknown as Blob);
    body.append("milestoneId", selectedMilestone);
    setBusy(true); setError("");
    try { await api(`/api/projects/${project.id}/assets`, { method: "POST", body }); await load(); Alert.alert("Evidence submitted", "Your original has been stored and linked to this milestone."); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Please try again."); }
    finally { setBusy(false); }
  }

  async function decide(milestoneId: string, verdict: "VERIFIED" | "REJECTED") {
    setBusy(true); setError("");
    try { await api(`/api/milestones/${milestoneId}/decision`, { method: "POST", body: JSON.stringify({ verdict, reason: verdict === "VERIFIED" ? "Reviewer confirmed the linked field evidence against the milestone criteria." : "Reviewer rejected the submitted evidence after comparing it with the milestone criteria." }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "The decision could not be saved."); }
    finally { setBusy(false); }
  }

  if (!project && !error) return <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator color={C.forest}/></View>;
  return <View style={styles.screen}><Stack.Screen options={{ title: project?.name ?? "Project" }}/><ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 38 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.forest} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}/>}><WordmarkHeader right={<Pressable onPress={() => router.back()}><Text style={{ color: C.forest, fontWeight: "700" }}>← Projects</Text></Pressable>}/>
    {error ? <Text accessibilityRole="alert" style={[styles.error, { marginVertical: 10 }]}>{error}</Text> : null}
    {project && <><Enter><Text style={styles.eyebrow}>{project.location.toUpperCase()} · {membership?.role.replaceAll("_", " ")}</Text><Text style={[styles.title, { marginTop: 8 }]}>{project.name}</Text><Text style={[styles.body, { marginTop: 7 }]}>{project.description}</Text><View style={[styles.row, { marginTop: 16 }]}><View style={[styles.card, { flex: 1, padding: 13 }]}><Text style={{ color: C.muted, fontSize: 9 }}>PROJECT BUDGET</Text><Text style={{ color: C.ink, fontWeight: "700", fontSize: 16, marginTop: 5 }}>{inr(project.budget)}</Text></View><View style={[styles.card, { flex: 1, padding: 13 }]}><Text style={{ color: C.muted, fontSize: 9 }}>EVIDENCE</Text><Text style={{ color: C.ink, fontWeight: "700", fontSize: 16, marginTop: 5 }}>{assets.length} submissions</Text></View></View></Enter>
      <View style={[styles.between, { marginTop: 27, marginBottom: 11 }]}><Text style={{ color: C.ink, fontSize: 18, fontWeight: "700" }}>Milestones</Text><Text style={{ color: C.muted, fontSize: 10 }}>{project.milestones.length} in project</Text></View>
      {project.milestones.map((milestone, index) => <Enter key={milestone.id} delay={index * 40} style={{ marginBottom: 9 }}><View style={styles.card}><View style={styles.between}><Text style={styles.eyebrow}>{milestone.verdict.replaceAll("_", " ")}</Text><Text style={{ color: C.ink, fontSize: 13, fontWeight: "700" }}>{inr(milestone.amount)}</Text></View><Text style={{ color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 9 }}>{milestone.title}</Text><Text style={[styles.body, { marginTop: 5 }]}>{milestone.criteria}</Text><View style={[styles.between, { borderTopWidth: 1, borderColor: C.line, marginTop: 12, paddingTop: 11 }]}><Text style={{ color: C.muted, fontSize: 10 }}>Due {new Date(milestone.dueAt).toLocaleDateString()}</Text><Text style={{ color: C.sage, fontWeight: "700", fontSize: 10 }}>Trust {Math.round(milestone.trustScore * 100)}%</Text></View>{canReview && milestone.verdict !== "VERIFIED" ? <View style={[styles.row, { marginTop: 12 }]}><View style={{ flex: 1 }}><Button title="Verify & release" disabled={busy} onPress={() => decide(milestone.id, "VERIFIED")}/></View><Button title="Reject" secondary disabled={busy} onPress={() => decide(milestone.id, "REJECTED")}/></View> : null}</View></Enter>)}
      <View style={[styles.between, { marginTop: 23, marginBottom: 11 }]}><Text style={{ color: C.ink, fontSize: 18, fontWeight: "700" }}>Field evidence</Text><Text style={{ color: C.muted, fontSize: 10 }}>{assets.length} originals</Text></View>
      {canSubmit && project.milestones.length > 0 ? <View style={[styles.card, { marginBottom: 10 }]}><Text style={{ color: C.ink, fontWeight: "600", fontSize: 12 }}>Attach proof to</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 10 }}>{project.milestones.map(m => <Pressable key={m.id} onPress={() => setSelectedMilestone(m.id)} style={{ backgroundColor: selectedMilestone === m.id ? C.forest : C.paper, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 11 }}><Text style={{ color: selectedMilestone === m.id ? C.white : C.muted, fontSize: 10, fontWeight: "600" }}>{m.title}</Text></Pressable>)}</ScrollView><Button title={busy ? "Uploading original…" : "＋  Submit field photo"} disabled={busy || !selectedMilestone} onPress={uploadEvidence}/><Text style={{ color: C.muted, fontSize: 10, textAlign: "center", marginTop: 9 }}>JPEG, PNG or WebP · up to 12 MB · uploaded to your workspace</Text></View> : null}
      {!assets.length ? <View style={[styles.card, { padding: 17 }]}><Text style={styles.body}>No evidence has been submitted for this project yet.</Text></View> : assets.map((asset, index) => <Enter key={asset.id} delay={index * 25} style={{ marginBottom: 8 }}><View style={[styles.card, { flexDirection: "row", gap: 12, padding: 10 }]}><Image source={{ uri: `${apiBase}${asset.thumbnailUrl}`, headers: { authorization: `Bearer ${sessionToken}` } }} style={{ width: 80, height: 76, borderRadius: 8, backgroundColor: C.pale }}/><View style={{ flex: 1, justifyContent: "center", gap: 5 }}><Text style={styles.eyebrow}>{asset.status.replaceAll("_", " ")}</Text><Text numberOfLines={2} style={{ color: C.ink, fontSize: 12, fontWeight: "700" }}>{asset.caption || asset.milestone?.title || "Field submission"}</Text><Text style={{ color: C.muted, fontSize: 9 }}>SHA-256 · {asset.sha256.slice(0, 14)}…</Text><Text style={{ color: C.muted, fontSize: 9 }}>{new Date(asset.createdAt).toLocaleString()}</Text></View><Text style={{ color: C.sage, fontWeight: "700", fontSize: 11 }}>{Math.round(asset.trustScore * 100)}%</Text></View></Enter>)}
    </>}
  </ScrollView></View>;
}
