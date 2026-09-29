"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, CircleAlert, CloudUpload, ExternalLink, Fingerprint, FolderPlus, Leaf, LogOut, Plus, ShieldCheck, Wallet } from "lucide-react";

type Membership = { organizationId: string; organizationName: string; role: string };
type User = { id: string; name: string; email: string; memberships: Membership[] };
type Project = { id: string; name: string; description: string; location: string; budget: number; funded: number; isPublic: boolean; latitude: number | null; longitude: number | null; organizationId: string; milestones: Milestone[]; _count: { assets: number } };
type Milestone = { id: string; title: string; criteria: string; amount: number; dueAt: string; minTrust: number; verdict: string; trustScore: number; releasedAt: string | null; _count?: { assets: number } };
type Check = { label: string; score: number; detail: string };
type Asset = { id: string; thumbnailUrl: string; caption: string | null; status: string; trustScore: number; sha256: string; capturedAt: string | null; createdAt: string; analysis: { checks?: Check[] | null; originalName?: string; metadata?: { hasExif?: boolean; software?: string | null } } | null; milestone: { id: string; title: string } | null };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function AppShell() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notice, setNotice] = useState("");
  const [showProject, setShowProject] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("REVIEWER");
  const [fundAmount, setFundAmount] = useState("");
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const active = projects.find(p => p.id === selectedId) ?? projects[0];
  const membership = user?.memberships.find(m => m.organizationId === active?.organizationId);
  const role = membership?.role ?? "";
  const canManage = ["FUNDER", "NGO_ADMIN"].includes(role);
  const canReview = role === "REVIEWER";

  const refresh = useCallback(async () => {
    const [sessionResponse, projectResponse] = await Promise.all([fetch("/api/auth/session", { cache: "no-store" }), fetch("/api/projects", { cache: "no-store" })]);
    const session = await sessionResponse.json();
    if (!session.user) { setUser(null); setProjects([]); return; }
    setUser(session.user);
    if (!projectResponse.ok) { setError("Could not load workspace projects."); return; }
    const data = await projectResponse.json();
    setProjects(data.projects);
    setSelectedId(current => data.projects.some((p: Project) => p.id === current) ? current : data.projects[0]?.id ?? "");
  }, []);

  useEffect(() => { refresh().catch(() => setError("Cannot reach ProofPay API. Check the server and database." )).finally(() => setChecking(false)); }, [refresh]);
  useEffect(() => {
    if (!active) { setAssets([]); return; }
    fetch(`/api/projects/${active.id}/assets`, { cache: "no-store" }).then(async r => r.ok ? r.json() : { assets: [] }).then(d => setAssets(d.assets ?? [])).catch(() => setAssets([]));
  }, [active?.id]);
  useEffect(() => { if (!active?.milestones.length) return; if (!active.milestones.some(m => m.id === selectedMilestone)) setSelectedMilestone(active.milestones[0].id); }, [active?.id, active?.milestones, selectedMilestone]);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
    return data;
  }
  async function act(work: () => Promise<void>) { setError(""); setNotice(""); setBusy(true); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } }
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await act(async () => { const orgId = active?.organizationId ?? user?.memberships[0]?.organizationId; await api(`/api/projects?organizationId=${orgId}`, { method: "POST", body: JSON.stringify({ name: form.get("name"), description: form.get("description"), location: form.get("location"), budget: Number(form.get("budget")), latitude: form.get("latitude") ? Number(form.get("latitude")) : null, longitude: form.get("longitude") ? Number(form.get("longitude")) : null }) }); setShowProject(false); await refresh(); setNotice("Project created. Fund it to allocate milestones."); });
  }
  async function createMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return; const form = new FormData(event.currentTarget);
    await act(async () => { await api(`/api/projects/${active.id}/milestones`, { method: "POST", body: JSON.stringify({ title: form.get("title"), criteria: form.get("criteria"), amount: Number(form.get("amount")), dueAt: new Date(String(form.get("dueAt"))).toISOString(), minTrust: 0.8 }) }); setShowMilestone(false); await refresh(); setNotice("Milestone allocated in escrow."); });
  }
  async function fundProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return;
    await act(async () => { await api(`/api/projects/${active.id}/fund`, { method: "POST", body: JSON.stringify({ amount: Number(fundAmount), idempotencyKey: crypto.randomUUID() }) }); setFundAmount(""); await refresh(); setNotice("Simulated escrow funded. This does not move real money."); });
  }
  async function uploadFiles(files: FileList | null) {
    if (!active || !selectedMilestone || !files?.length) return;
    await act(async () => { for (const file of Array.from(files)) { const data = new FormData(); data.set("file", file); data.set("milestoneId", selectedMilestone); await api(`/api/projects/${active.id}/assets`, { method: "POST", body: data }); } await refresh(); const response = await fetch(`/api/projects/${active.id}/assets`, { cache: "no-store" }); setAssets((await response.json()).assets ?? []); setNotice("Original evidence stored. Analysis and trust checks are attached to the asset record."); });
  }
  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!membership) return;
    await act(async () => { await api(`/api/organizations/${membership.organizationId}/members`, { method: "POST", body: JSON.stringify({ email: memberEmail, role: memberRole }) }); setMemberEmail(""); setNotice(`${memberRole.replaceAll("_", " ")} access assigned. The change is in the audit log.`); });
  }
  async function setPublic() {
    if (!active) return;
    await act(async () => { await api(`/api/projects/${active.id}`, { method: "PATCH", body: JSON.stringify({ isPublic: !active.isPublic }) }); await refresh(); });
  }
  async function decision(milestone: Milestone, verdict: "VERIFIED" | "REJECTED") {
    if (!active) return;
    await act(async () => { await api(`/api/milestones/${milestone.id}/decision`, { method: "POST", body: JSON.stringify({ verdict, reason: verdict === "VERIFIED" ? "Reviewer confirmed the linked field evidence against the milestone criteria." : "Reviewer rejected the submitted evidence after comparing it with the milestone criteria." }) }); await refresh(); setNotice(verdict === "VERIFIED" ? "Milestone verified and simulated escrow released once." : "Milestone rejected. Decision saved to the audit trail."); });
  }

  if (checking) return <div className="app-loading"><div className="brand-mark"><span/></div><p>Opening your workspace…</p></div>;
  if (!user) return <AuthPanel onSuccess={async () => { setChecking(true); try { await refresh(); } catch { setError("Account created, but the database could not be reached."); } finally { setChecking(false); } }} error={error} setError={setError}/>;
  if (!projects.length) return <main className="workspace-app"><Header user={user} role={role} onLogout={async()=>{await api("/api/auth/logout",{method:"POST"});setUser(null);}}/><section className="empty-workspace"><div className="brand-mark"><span/></div><span className="app-kicker">YOUR WORKSPACE IS READY</span><h1>Start with a project.</h1><p>Create a funded project, define its proof criteria, then invite your field team and independent reviewer.</p><button className="app-primary" onClick={()=>setShowProject(true)}><FolderPlus size={16}/> Create your first project</button></section>{showProject&&<ProjectForm onClose={()=>setShowProject(false)} onSubmit={createProject} busy={busy}/>}</main>;

  const released = active.milestones.filter(m => m.releasedAt).reduce((n,m)=>n+m.amount,0);
  const allocated = active.milestones.reduce((n,m)=>n+m.amount,0);
  const remaining = active.funded - allocated;
  return <main className="workspace-app">
    <Header user={user} role={role} onLogout={async()=>{await api("/api/auth/logout",{method:"POST"});setUser(null);setProjects([]);}}/>
    <div className="workspace-content">
      <div className="workspace-title"><div><span className="app-kicker">{active.location.toUpperCase()} · {membership?.organizationName.toUpperCase()}</span><h1>{active.name}</h1><p>{active.description}</p></div><div className="title-actions"><select value={active.id} onChange={e=>setSelectedId(e.target.value)}>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>{canManage&&<button className="app-quiet" onClick={()=>setShowProject(true)}><Plus size={15}/>New project</button>}</div></div>
      <div className="app-notice"><ShieldCheck size={15}/> SIMULATED ESCROW · Real funds are never moved from this workspace <a href="/api/health" target="_blank">System status</a></div>
      {error&&<div className="app-alert"><CircleAlert size={15}/>{error}<button onClick={()=>setError("")}>Dismiss</button></div>}{notice&&<div className="app-success"><BadgeCheck size={15}/>{notice}<button onClick={()=>setNotice("")}>Dismiss</button></div>}
      <div className="app-metrics"><Metric label="PROJECT BUDGET" value={money(active.budget)}/><Metric label="SIMULATED ESCROW FUNDED" value={money(active.funded)}/><Metric label="RELEASED" value={money(released)}/><Metric label="EVIDENCE ASSETS" value={String(active._count.assets)}/></div>
      <div className="app-layout"><section className="app-column">
        <div className="app-panel"><div className="app-panel-head"><div><span className="app-kicker">ALLOCATED AGAINST ESCROW</span><h2>Milestones</h2></div>{canManage&&<button className="app-quiet" disabled={remaining<=0} onClick={()=>setShowMilestone(true)}><Plus size={15}/>Add milestone</button>}</div>
          {!active.milestones.length?<div className="app-empty">Fund the project, then add milestones with clear, checkable field criteria.</div>:active.milestones.map(m=><article className="real-milestone" key={m.id}><div className="real-mile-icon"><Leaf size={16}/></div><div className="real-mile-body"><div className="real-mile-top"><span>{m.verdict.replaceAll("_"," ")}</span><b>{money(m.amount)}</b></div><h3>{m.title}</h3><p>{m.criteria}</p><div className="real-mile-foot"><span>{m._count?.assets ?? 0} linked assets</span><span>Trust {Math.round(m.trustScore*100)}%</span><span>Due {new Date(m.dueAt).toLocaleDateString()}</span></div></div>{canReview&&m.verdict!=="VERIFIED"&&<div className="review-buttons"><button disabled={busy} onClick={()=>decision(m,"VERIFIED")}>Verify & release</button><button disabled={busy} onClick={()=>decision(m,"REJECTED")}>Reject</button></div>}{m.releasedAt&&<BadgeCheck className="released-check" size={18}/>}</article>)}
        </div>
        <div className="app-panel evidence-panel"><div className="app-panel-head"><div><span className="app-kicker">ORIGINALS · PROVENANCE · ANALYSIS</span><h2>Field evidence <small>{assets.length}</small></h2></div><button className="app-primary" disabled={!active.milestones.length||busy} onClick={()=>fileRef.current?.click()}><CloudUpload size={15}/>{busy?"Working…":"Upload original"}</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden multiple onChange={e=>uploadFiles(e.target.files)}/></div>
          {active.milestones.length>0&&<div className="upload-destination"><label>Linked milestone<select value={selectedMilestone} onChange={e=>setSelectedMilestone(e.target.value)}>{active.milestones.map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select></label><span>JPEG, PNG, WebP · max 12 MB · private Cloudinary originals</span></div>}
          {!assets.length?<div className="app-empty">No submissions yet. Upload an image to store the original and create its evidence record.</div>:<div className="real-assets">{assets.map(a=><article className="real-asset" key={a.id}><img src={a.thumbnailUrl} alt={a.analysis?.originalName??"Field evidence"}/><div className="real-asset-body"><span>{a.status.replaceAll("_"," ")} · {a.milestone?.title??"Unlinked"}</span><b>{a.caption??"Awaiting vision analysis"}</b><small>sha256:{a.sha256.slice(0,12)}… · {new Date(a.createdAt).toLocaleString()}</small><details className="asset-proof"><summary><Fingerprint size={12}/> Provenance & verification</summary><div className="asset-proof-content"><code>SHA-256 · {a.sha256}</code><span>Captured {a.capturedAt?new Date(a.capturedAt).toLocaleString():"time unavailable in EXIF"} · {a.analysis?.metadata?.hasExif?"EXIF present":"EXIF missing"}{a.analysis?.metadata?.software?` · edit software: ${a.analysis.metadata.software}`:""}</span>{a.analysis?.checks?.map(check=><span key={check.label}><b>{check.label}</b> · {Math.round(check.score*100)}% · {check.detail}</span>)}<div><a href={`/api/assets/${a.id}/original`} target="_blank" rel="noreferrer">View private original <ExternalLink size={11}/></a><a href={`/api/assets/${a.id}/verify`} target="_blank" rel="noreferrer">Recompute SHA-256 <ArrowRight size={11}/></a></div></div></details></div><strong>{Math.round(a.trustScore*100)}%</strong></article>)}</div>}
        </div>
      </section><aside className="app-column app-side">
        {role==="FUNDER"&&<div className="app-panel"><div className="app-panel-head"><div><span className="app-kicker">DOUBLE-ENTRY LEDGER</span><h2>Escrow</h2></div><Wallet size={17}/></div><p className="escrow-copy">Funding writes an idempotent ledger entry. Milestone creation moves available funds into a held account.</p><div className="escrow-numbers"><span>Unallocated balance</span><b>{money(remaining)}</b></div><form className="inline-form" onSubmit={fundProject}><label>Amount to fund (whole rupees)<input required type="number" min="1" max={active.budget-active.funded} step="1" value={fundAmount} onChange={e=>setFundAmount(e.target.value)}/></label><button disabled={busy||!fundAmount||Number(fundAmount)>active.budget-active.funded} className="app-primary"><Wallet size={14}/>Fund simulation</button></form></div>}
        {role==="FUNDER"&&<div className="app-panel"><div className="app-panel-head"><div><span className="app-kicker">ROLE BASED ACCESS</span><h2>Workspace team</h2></div></div><p className="escrow-copy">Add existing ProofPay accounts as field workers, NGO admins, reviewers or read-only auditors.</p><form className="inline-form" onSubmit={addMember}><label>Account email<input required type="email" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} placeholder="colleague@example.org"/></label><label>Workspace role<select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option value="REVIEWER">Independent reviewer</option><option value="NGO_ADMIN">NGO admin</option><option value="FIELD_WORKER">Field worker</option><option value="AUDITOR">Read only auditor</option><option value="FUNDER">Funder</option></select></label><button disabled={busy} className="app-primary"><Plus size={14}/>Assign role</button></form></div>}
        {role==="FUNDER"&&<div className="app-panel"><div className="app-panel-head"><div><span className="app-kicker">PUBLIC TRACEABILITY</span><h2>Impact ledger</h2></div><Fingerprint size={17}/></div><p className="escrow-copy">Verified milestone claims and signed evidence previews can be viewed without an account.</p><div className="public-toggle"><span>Public access</span><button className={active.isPublic?"toggle on":"toggle"} onClick={setPublic} aria-label="Toggle public ledger"><i/></button><b>{active.isPublic?"ON":"OFF"}</b></div>{active.isPublic&&<a className="ledger-link" href={`/ledger/${active.id}`} target="_blank">Open public ledger <ArrowRight size={13}/></a>}</div>}
        {role==="AUDITOR"&&<div className="app-panel auditor-note"><Fingerprint size={19}/><b>Auditor access</b><p>You can inspect project, milestone and evidence records. Changing the ledger or submitting decisions is restricted.</p></div>}
        {role==="FIELD_WORKER"&&<div className="app-panel auditor-note"><CloudUpload size={19}/><b>Field submission access</b><p>You can submit evidence to the selected project. Funding, criteria, roles and review decisions are restricted.</p></div>}
        <div className="app-panel"><div className="app-panel-head"><div><span className="app-kicker">ACTIVITY RECORD</span><h2>How ProofPay decides</h2></div></div><ol className="flow-list"><li><i>01</i><span>Original image is stored privately; SHA-256 is calculated on the server.</span></li><li><i>02</i><span>EXIF time/GPS, perceptual duplicate check and criteria relevance form an explainable trust score.</span></li><li><i>03</i><span>Above the milestone threshold verifies and releases simulated funds; mid-range results need reviewer action.</span></li></ol><p className="no-key-note">Without Cloudinary and Gemini credentials, the app records no fabricated scores. Add credentials in <code>.env</code> and restart.</p></div>
      </aside></div>
    </div>
    {showProject&&<ProjectForm onClose={()=>setShowProject(false)} onSubmit={createProject} busy={busy}/>}{showMilestone&&<MilestoneForm remaining={remaining} onClose={()=>setShowMilestone(false)} onSubmit={createMilestone} busy={busy}/>}
  </main>;
}

function Header({user,role,onLogout}:{user:User;role:string;onLogout:()=>Promise<void>}){return <header className="workspace-header"><a href="/" className="app-brand"><span className="brand-mark"><span/></span>proofpay <small>IMPACT WORKSPACE</small></a><div className="header-user"><div><b>{user.name}</b><span>{role.replaceAll("_"," ")}</span></div><button onClick={onLogout} title="Sign out"><LogOut size={16}/></button></div></header>}
function Metric({label,value}:{label:string;value:string}){return <article className="app-metric"><span>{label}</span><b>{value}</b></article>}
function AuthPanel({onSuccess,error,setError}:{onSuccess:()=>Promise<void>;error:string;setError:(s:string)=>void}){
  const [mode,setMode]=useState<"login"|"register">("register"); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError("");try{const response=await fetch(`/api/auth/${mode}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:form.get("name"),email:form.get("email"),password:form.get("password"),organization:form.get("organization")})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Authentication failed");await onSuccess();}catch(e){setError(e instanceof Error?e.message:"Could not reach the server.");}finally{setBusy(false);}}
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><span className="brand-mark"><span/></span>proofpay</div><div className="auth-visual-copy"><span>PROOF THAT TRAVELS FURTHER</span><h1>Good work<br/><em>deserves</em> to be seen.</h1><p>Field evidence becomes trusted impact. Every milestone, every decision, every rupee—with a trail you can follow.</p></div><div className="auth-visual-foot"><span><ShieldCheck size={15}/> PROVENANCE FIRST</span><span>GUJARAT · INDIA</span></div></section><section className="auth-form-side"><div className="auth-card"><span className="app-kicker">{mode==="register"?"START A NEW WORKSPACE":"WELCOME BACK"}</span><h2>{mode==="register"?"Make impact accountable.":"Pick up where you left off."}</h2><p>{mode==="register"?"Set up your workspace. You’ll start as its funder and can assign roles to your team.":"Sign in to your impact workspace."}</p><div className="auth-tabs"><button className={mode==="register"?"selected":""} onClick={()=>{setMode("register");setError("")}}>Create account</button><button className={mode==="login"?"selected":""} onClick={()=>{setMode("login");setError("")}}>Sign in</button></div><form onSubmit={submit}>{mode==="register"&&<><label>Your name<input autoComplete="name" required name="name" minLength={2} maxLength={80}/></label><label>Workspace name<input autoComplete="organization" required name="organization" minLength={2} maxLength={100} placeholder="e.g. Aranya Foundation"/></label></>}<label>Email address<input autoComplete="email" type="email" name="email" required maxLength={254}/></label><label>Password<input autoComplete={mode==="register"?"new-password":"current-password"} type="password" name="password" required minLength={mode==="register"?12:1} maxLength={128} placeholder={mode==="register"?"At least 12 characters":""}/></label>{error&&<div className="auth-error"><CircleAlert size={14}/>{error}</div>}<button className="app-primary auth-submit" disabled={busy}>{busy?"Please wait…":mode==="register"?"Create secure workspace":"Sign in"}<ArrowRight size={15}/></button></form><div className="auth-foot"><ShieldCheck size={14}/> Passwords are scrypt-hashed. Sessions are HttpOnly and revocable.</div></div></section></main>
}

function ProjectForm({onClose,onSubmit,busy}:{onClose:()=>void;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;busy:boolean}){return <div className="app-modal-backdrop"><form className="app-form-modal" onSubmit={onSubmit}><button type="button" className="app-modal-x" onClick={onClose}>×</button><span className="app-kicker">PROJECT SETUP</span><h2>Start with a place.</h2><label>Project name<input name="name" required minLength={3} maxLength={120}/></label><label>What work will happen here?<textarea name="description" required minLength={8} maxLength={2000}/></label><label>Site location<input name="location" required minLength={2} maxLength={160} placeholder="Village, district, state"/></label><div className="form-pair"><label>Latitude <input name="latitude" type="number" step="any" min="-90" max="90" placeholder="Optional"/></label><label>Longitude <input name="longitude" type="number" step="any" min="-180" max="180" placeholder="Optional"/></label></div><label>Project budget (whole rupees)<input name="budget" type="number" required min="1" step="1"/></label><div className="form-actions"><button type="button" className="app-quiet" onClick={onClose}>Cancel</button><button className="app-primary" disabled={busy}><FolderPlus size={14}/>Create project</button></div></form></div>}
function MilestoneForm({remaining,onClose,onSubmit,busy}:{remaining:number;onClose:()=>void;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;busy:boolean}){return <div className="app-modal-backdrop"><form className="app-form-modal" onSubmit={onSubmit}><button type="button" className="app-modal-x" onClick={onClose}>×</button><span className="app-kicker">ESCROW ALLOCATION</span><h2>Define proof before payment.</h2><label>Milestone title<input name="title" required minLength={3} maxLength={160}/></label><label>Visual criteria<textarea name="criteria" required minLength={10} maxLength={3000} placeholder="Describe what a reviewer should be able to see…"/></label><label>Milestone amount · available {money(Math.max(0,remaining))}<input name="amount" type="number" required min="1" max={remaining} step="1"/></label><label>Due date<input name="dueAt" type="date" required min={new Date().toISOString().slice(0,10)}/></label><div className="form-actions"><button type="button" className="app-quiet" onClick={onClose}>Cancel</button><button className="app-primary" disabled={busy||remaining<=0}><Plus size={14}/>Allocate milestone</button></div></form></div>}
