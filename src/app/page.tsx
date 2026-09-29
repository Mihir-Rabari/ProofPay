import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck, Fingerprint, Leaf } from "lucide-react";

const steps = [
  { number: "01", title: "Set milestones", copy: "Define checkable outcomes and allocate the project budget." },
  { number: "02", title: "Submit evidence", copy: "Field teams upload original photos with their capture details." },
  { number: "03", title: "Review and decide", copy: "Reviewers compare the evidence with the milestone criteria." },
];

export default function LandingPage() {
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="app-brand"><span className="brand-mark"><span/></span>proofpay</Link><nav><a href="#how-it-works">How it works</a></nav><div><Link className="landing-login" href="/login">Sign in</Link><Link className="landing-nav-cta" href="/workspace">Workspace <ArrowRight size={14}/></Link></div></header>
    <section className="landing-hero">
      <div className="hero-copy"><h1>Funds move when<br/>the <em>work is real.</em></h1><p>Link field evidence to project milestones and review each decision.</p><div className="hero-actions"><Link href="/workspace" className="hero-primary">Open workspace <ArrowRight size={16}/></Link><a href="#how-it-works" className="hero-secondary">How it works <ArrowDown size={15}/></a></div><p className="escrow-disclosure">Payments are simulated. No money moves.</p></div>
      <div className="hero-art" aria-label="Illustration of field evidence connected to a review record"><div className="art-sun"/><div className="art-horizon horizon-back"/><div className="art-horizon horizon-front"/><div className="art-field-lines"/><div className="art-stamp"><Fingerprint size={17}/><span>PROVENANCE</span><b>Original retained</b><small>SERVER HASH</small></div><div className="art-proof-card"><span className="proof-check"><BadgeCheck size={16}/></span><div><small>REVIEW RECORD</small><b>Evidence linked to milestone</b><span>Reviewer decision saved <i/></span></div><strong>SAVED</strong></div><div className="art-caption"><span>PRIVATE BY DEFAULT</span><span>FIELD EVIDENCE</span></div></div>
    </section>
    <section className="landing-ribbon"><span><Leaf size={14}/> FIELD TO REVIEW</span><i/><span>Evidence linked to milestones</span><i/><span>Decisions recorded</span></section>
    <section id="how-it-works" className="landing-steps"><div className="landing-section-head"><h2>One record from<br/><em>plan to proof.</em></h2><p>Funders, field teams and reviewers work from the same project record.</p></div><div className="step-grid">{steps.map((step,i)=><article className="step-card" key={step.number}><div className="step-top"><span>{step.number}</span>{i===0?<Leaf/>:i===1?<Fingerprint/>:<BadgeCheck/>}</div><h3>{step.title}</h3><p>{step.copy}</p><div className="step-rule"><i style={{width:`${(i+1)*33}%`}}/></div></article>)}</div></section>
    <footer className="landing-footer"><Link href="/" className="app-brand"><span className="brand-mark"><span/></span>proofpay</Link></footer>
  </main>;
}
