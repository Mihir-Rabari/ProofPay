import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { Project, useSession } from "../api";
import { Button, C, Enter, styles, WordmarkHeader } from "../ui";

const inr = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export default function ProjectsScreen() {
  const { actor, loading, api, logout } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const load = useCallback(async () => { setError(""); try { const data = await api<{ projects: Project[] }>("/api/projects"); setProjects(data.projects); } catch (e) { setError(e instanceof Error ? e.message : "Could not load projects."); } }, [api]);
  useEffect(() => {
    if (!actor) return;
    let active = true;
    api<{ projects: Project[] }>("/api/projects")
      .then(data => { if (active) { setProjects(data.projects); setError(""); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load projects."); });
    return () => { active = false; };
  }, [actor, api]);
  if (!loading && !actor) return <Redirect href="/"/>;
  const orgRoles = actor?.memberships.map(m => m.role.replaceAll("_", " ")).join(" · ") ?? "";
  return <View style={styles.screen}><FlatList data={projects} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 34, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.forest} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}/>} ListHeaderComponent={<><WordmarkHeader right={<Button title="Sign out" secondary onPress={() => logout()}/>} /><Enter><Text style={styles.eyebrow}>YOUR FIELD WORKSPACE</Text><Text style={[styles.title, { marginTop: 8 }]}>Good morning,{"\n"}{actor?.name.split(" ")[0]}.</Text><Text style={[styles.body, { marginTop: 8 }]}>{orgRoles}</Text><View style={[styles.between, { marginTop: 28, marginBottom: 12 }]}><Text style={{ color: C.ink, fontWeight: "700", fontSize: 17 }}>Active projects</Text><Text style={{ color: C.muted, fontSize: 11 }}>{projects.length} total</Text></View>{error ? <Text style={[styles.error, { marginBottom: 12 }]}>{error}</Text> : null}</Enter></>} ListEmptyComponent={!loading ? <View style={[styles.card, { padding: 22, marginTop: 3 }]}><Text style={{ fontSize: 24, marginBottom: 8 }}>⌁</Text><Text style={{ color: C.ink, fontSize: 16, fontWeight: "700" }}>No projects yet</Text><Text style={[styles.body, { marginTop: 5 }]}>When your organization adds you to a project, it will appear here.</Text></View> : <ActivityIndicator style={{ marginTop: 22 }} color={C.forest}/>} renderItem={({ item, index }) => <Enter delay={index * 45} style={{ marginBottom: 10 }}><View style={styles.card}><View style={styles.between}><Text style={styles.eyebrow}>{item.location.toUpperCase()}</Text><View style={styles.badge}><Text style={{ color: C.sage, fontSize: 9, fontWeight: "700" }}>{item.milestones.length} MILESTONES</Text></View></View><Text style={{ color: C.ink, fontSize: 19, fontWeight: "700", letterSpacing: -.45, marginTop: 11 }}>{item.name}</Text><Text numberOfLines={2} style={[styles.body, { marginTop: 5 }]}>{item.description}</Text><View style={[styles.between, { borderTopWidth: 1, borderColor: C.line, paddingTop: 13, marginTop: 15, marginBottom: 13 }]}><View><Text style={{ color: C.muted, fontSize: 9 }}>BUDGET</Text><Text style={{ color: C.ink, fontSize: 13, fontWeight: "700", marginTop: 3 }}>{inr(item.budget)}</Text></View><View><Text style={{ color: C.muted, fontSize: 9 }}>EVIDENCE</Text><Text style={{ color: C.ink, fontSize: 13, fontWeight: "700", marginTop: 3 }}>{item._count.assets} items</Text></View></View><Button title="Open project  →" onPress={() => router.push({ pathname: "/projects/[projectId]", params: { projectId: item.id } })}/></View></Enter>}/></View>;
}
