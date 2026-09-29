import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function PublicLedger({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, isPublic: true }, select: { name: true, description: true, location: true, milestones: { where: { verdict: "VERIFIED" }, include: { assets: { select: { id: true, sha256: true, capturedAt: true, caption: true, trustScore: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!project) notFound();
  return <main className="public-ledger"><header><a className="app-brand" href="/"><span className="brand-mark"><span/></span>proofpay <small>PUBLIC LEDGER</small></a><span>READ ONLY · EVIDENCE LINKED</span></header><section className="public-ledger-head"><span className="app-kicker">{project.location.toUpperCase()} · OPEN IMPACT RECORD</span><h1>{project.name}</h1><p>{project.description}</p></section><div className="public-ledger-list">{project.milestones.map(m=><section className="public-milestone" key={m.id}><div className="public-milestone-title"><BadgeCheckIcon/><div><span>VERIFIED MILESTONE · {Math.round(m.trustScore*100)}% MEAN TRUST</span><h2>{m.title}</h2><p>{m.criteria}</p></div></div><div className="public-assets">{m.assets.map(a=><article key={a.id}><img src={`/api/assets/${a.id}/thumbnail`} alt="Verified project evidence"/><div><span>{a.capturedAt?new Date(a.capturedAt).toLocaleString():"Capture time unavailable"}</span><p>{a.caption??"Evidence image"}</p><code>sha256:{a.sha256}</code><small>Evidence ID · {a.id} · <a href={`/api/assets/${a.id}/verify`} target="_blank" rel="noreferrer">Verify original integrity</a></small></div></article>)}</div></section>)}</div><footer>Public ledger · Original media stays access-controlled. Only the derived preview is public.</footer></main>;
}
function BadgeCheckIcon(){return <span className="public-badge">✓</span>}
