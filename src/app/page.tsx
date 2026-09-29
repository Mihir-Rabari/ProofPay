import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck, Fingerprint, Leaf, ShieldCheck, Sparkles } from "lucide-react";

const steps = [
  { number: "01", title: "Set the outcome", copy: "Write milestones people can actually verify. Allocate the project budget against clear criteria." },
  { number: "02", title: "Bring back proof", copy: "Field teams submit original photos. ProofPay records provenance, metadata and a tamper-evident fingerprint." },
  { number: "03", title: "Review with context", copy: "Evidence, checks and decisions stay together. A human reviewer can make the final call." },
];

export default function LandingPage() {
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="app-brand"><span className="brand-mark"><span/></span>proofpay</Link><nav><a href="#how-it-works">How it works</a><a href="#principles">Our principles</a></nav><div><Link className="landing-login" href="/login">Sign in</Link><Link className="landing-nav-cta" href="/workspace">Open workspace <ArrowRight size={14}/></Link></div></header>
    <section className="landing-hero">
      <div className="hero-copy"><span className="landing-eyebrow"><i/> ACCOUNTABILITY, ALL THE WAY TO THE GROUND</span><h1>Funds move when<br/>the <em>work is real.</em></h1><p>ProofPay connects field evidence to measurable milestones, so every funding decision has a story you can follow.</p><div className="hero-actions"><Link href="/workspace" className="hero-primary">Build your workspace <ArrowRight size={16}/></Link><a href="#how-it-works" className="hero-secondary">See how it works <ArrowDown size={15}/></a></div><div className="hero-footnote"><ShieldCheck size={14}/> Original evidence. Human oversight. A record that stays.</div><p className="escrow-disclosure">Current pilot: escrow is simulated. No real money moves and payout providers are not connected.</p></div>
      <div className="hero-art" aria-label="Illustration of field evidence connected to a review record"><div className="art-sun"/><div className="art-horizon horizon-back"/><div className="art-horizon horizon-front"/><div className="art-field-lines"/><div className="art-stamp"><Fingerprint size={17}/><span>PROVENANCE</span><b>Original retained</b><small>HASHED ON THE SERVER</small></div><div className="art-proof-card"><span className="proof-check"><BadgeCheck size={16}/></span><div><small>EVIDENCE · REVIEW TRAIL</small><b>Proof linked to a milestone</b><span>Human decision recorded <i/></span></div><strong>RECORDED</strong></div><div className="art-caption"><span>PRIVATE BY DEFAULT</span><span>PROOF, WITH CONTEXT</span></div></div>
      <div className="hero-side-note">A clearer line<br/>from promise to<br/><i>progress.</i></div>
    </section>
    <section className="landing-ribbon"><span><Leaf size={14}/> DESIGNED FOR FIELD REALITY</span><i/><span>Evidence before release</span><i/><span>Decisions with context</span><i/><span>Every change accounted for</span></section>
    <section id="how-it-works" className="landing-steps"><div className="landing-section-head"><span className="landing-eyebrow">A SIMPLE, TRACEABLE LOOP</span><h2>Make every rupee<br/><em>easier to trust.</em></h2><p>ProofPay gives funders, field teams and reviewers one shared record—from the plan to the proof.</p></div><div className="step-grid">{steps.map((step,i)=><article className="step-card" key={step.number}><div className="step-top"><span>{step.number}</span>{i===0?<Leaf/>:i===1?<Fingerprint/>:<BadgeCheck/>}</div><h3>{step.title}</h3><p>{step.copy}</p><div className="step-rule"><i style={{width:`${(i+1)*33}%`}}/></div></article>)}</div></section>
    <section id="principles" className="landing-promise"><div className="promise-mark"><Sparkles size={18}/><span>THE PROOFPAY PROMISE</span></div><h2>Trust should be<br/><em>earned in the open.</em></h2><div><p>Evidence helps people make better decisions. It never replaces the judgment of the people closest to the work.</p><Link href="/workspace">See your workspace <ArrowRight size={15}/></Link></div></section>
    <footer className="landing-footer"><Link href="/" className="app-brand"><span className="brand-mark"><span/></span>proofpay</Link><span>IMPACT, WITH PROOF.</span><span>GUJARAT · INDIA</span></footer>
  </main>;
}
