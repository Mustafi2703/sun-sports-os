import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight, MessageCircle, FileSpreadsheet, PhoneCall, CreditCard, Calendar,
  Users, Award, BarChart3, CheckCircle2, Trophy, Activity, Gauge, CalendarDays, Target, LineChart,
  Sparkles, ShieldCheck, Star
} from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { HeroMockup } from "@/components/landing/HeroMockup";
import { Reveal } from "@/components/landing/Reveal";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const Landing = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 gradient-hero">
        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="animate-fade-in">
              <Badge className="mb-5 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
                <Sparkles className="h-3 w-3 mr-1.5" /> Built for Indian sports academies
              </Badge>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-balance">
                Stop chasing fees. <br />
                <span className="text-primary">Start running</span> your academy.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl">
                Automate attendance, fee collection, and parent communication — all in one place.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Link to="/app">
                  <Button size="lg" variant="outline" className="border-border w-full">Experience Now</Button>
                </Link>
              </div>
              <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Built for <span className="text-foreground font-medium">Sun Sports, Ahmedabad</span> — High Performance cricket academy
              </div>
            </div>

            <div className="relative">
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 sm:py-24 bg-card/30">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-sm font-medium text-destructive">The reality of running an academy today</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-balance">
              You didn't sign up to be a collections agent.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: MessageCircle, title: "Chasing late fees every month", desc: "Personal WhatsApp messages, awkward conversations, and unpaid invoices piling up." },
              { icon: FileSpreadsheet, title: "Paper registers & Excel chaos", desc: "Attendance scattered across notebooks. No insight, no trends, no way to spot churn." },
              { icon: PhoneCall, title: "Parents calling for updates", desc: "Daily calls asking 'Is my child improving?' — and no easy way to show them." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 120} className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
                <div className="h-10 w-10 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display font-semibold text-lg">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section id="features" className="py-20 sm:py-28">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">The fix</Badge>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-balance">
              SportsOS fixes all of this — <span className="text-primary">automatically.</span>
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: CreditCard, title: "Automated Fee Collection", desc: "Send WhatsApp payment reminders with UPI links. Auto-reconcile. Zero manual follow-up." },
              { icon: Calendar, title: "One-Tap Attendance", desc: "Coaches mark attendance from their phone in 30 seconds. Track trends. Catch churn early." },
              { icon: Users, title: "Parent Portal", desc: "Give every parent a dedicated portal to track attendance, fees, and progress. Reduce daily calls." },
              { icon: Award, title: "Coach Dashboard", desc: "Each coach sees only their batches. You see everything. Real-time, always updated." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 100} direction={i % 2 === 0 ? "left" : "right"} className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-all hover:shadow-glow">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-lg">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-lg border border-border bg-muted/20 h-28 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-primary/30 group-hover:text-primary/60 transition-colors" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cricket-specific features */}
      <section className="py-20 bg-card/30">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <Badge className="bg-secondary/10 text-secondary border-secondary/20 mb-4">Cricket-first</Badge>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">
              Built by cricket people, for cricket academies.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Trophy, t: "Monthly Batting & Bowling Cards", d: "Standardized assessment templates with progress over time." },
              { icon: Activity, t: "Tournament Performance Log", d: "Track innings, wickets, MoMs across local and inter-academy events." },
              { icon: Gauge, t: "Bowling Speed Tracker", d: "Log radar readings and watch pace progression bowler-by-bowler." },
              { icon: CalendarDays, t: "Seasonal Fee & Camp Management", d: "Run summer camps, IPL specials, and term fees side by side." },
              { icon: Target, t: "Net Practice Scheduling", d: "Allocate nets per batch, avoid double-booking, sync to coaches." },
              { icon: LineChart, t: "Match Statistics & Strike Rate", d: "Auto-compute SR, average, economy across all match entries." },
            ].map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={(i % 3) * 100} direction="scale" className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="font-display font-semibold">{t}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Case study */}
      <section id="case-study" className="py-20 sm:py-28">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">Case study</Badge>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">See it in action — DNA Sports, Ahmedabad</h2>
          </Reveal>
          <Reveal direction="scale" className="rounded-3xl border border-border bg-card overflow-hidden grid lg:grid-cols-5">
            <div className="lg:col-span-2 relative h-64 lg:h-auto bg-gradient-to-br from-primary/30 via-secondary/20 to-card flex items-center justify-center">
              <Trophy className="h-20 w-20 text-primary/60" />
              <div className="absolute bottom-4 left-4 rounded-lg glass px-3 py-1.5 text-xs">DNA Sports • Ahmedabad</div>
            </div>
            <div className="lg:col-span-3 p-8 sm:p-10">
              <div className="flex gap-1 text-primary mb-4">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="font-display text-xl sm:text-2xl text-foreground leading-snug text-balance">
                "SportsOS transformed how we manage our 120+ athletes. Fee collection is now automated, parents are delighted, and our coaches save 2 hours every day."
              </p>
              <p className="mt-5 text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Dr. Rushikesh Trivedi</span> — Founder, DNA Sports (GeneSports India)
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {[
                  { v: "120+", l: "Athletes Managed" },
                  { v: "2 hrs", l: "Saved Daily" },
                  { v: "40%", l: "Faster Fee Collection" },
                ].map(s => (
                  <div key={s.l} className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                    <p className="font-display text-2xl sm:text-3xl font-bold text-primary">{s.v}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28 bg-card/30">
        <div className="container">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">Pricing</Badge>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">Simple, transparent pricing.</h2>
            <p className="mt-3 text-muted-foreground">No setup fees. Cancel anytime. Pay in INR.</p>

            <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2">
              <span className={cn("text-sm", !annual && "text-foreground font-medium")}>Monthly</span>
              <Switch checked={annual} onCheckedChange={setAnnual} />
              <span className={cn("text-sm flex items-center gap-2", annual && "text-foreground font-medium")}>
                Annual <Badge className="bg-primary/15 text-primary border-0">Save 2 months</Badge>
              </span>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
            <Reveal delay={0}>
              <PricingTier
                name="Essentials" monthly={5000} annual={50000} annualToggle={annual}
                features={["Athlete CRM","Batch Management","Fee Tracking","Attendance","2 Admin Users","Email Support"]}
                cta="Start Free Trial"
              />
            </Reveal>
            <Reveal delay={120} direction="scale">
              <PricingTier
                name="Professional" monthly={10000} annual={100000} annualToggle={annual} popular
                features={["Everything in Essentials","Coach Dashboards","Parent Portal","WhatsApp Integration","Performance Tracking","5 Users","WhatsApp Support"]}
                cta="Start Free Trial"
              />
            </Reveal>
            <Reveal delay={240}>
              <PricingTier
                name="Academy Pro" monthly={20000} annual={200000} annualToggle={annual}
                features={["Everything in Professional","Multi-Branch Support","Custom Reports","Unlimited Users","Priority Support","Dedicated Onboarding"]}
                cta="Contact Us"
              />
            </Reveal>
          </div>

          <Reveal className="mt-8 max-w-4xl mx-auto rounded-2xl border border-primary/30 bg-primary/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-display font-semibold text-foreground">🎉 Founding Member Offer</p>
              <p className="text-sm text-muted-foreground mt-1">First 10 academies get <span className="text-primary font-medium">50% off Year 1</span>. Only <span className="text-foreground font-medium">6 spots left.</span></p>
            </div>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Claim Spot</Button>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-24">
        <div className="container max-w-3xl">
          <Reveal className="text-center mb-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Frequently asked questions</h2>
          </Reveal>
          <Reveal>
          <Accordion type="single" collapsible className="w-full">
            {[
              { q: "Is SportsOS difficult to set up?", a: "Not at all. Most academies are live in under 30 minutes. We import your student list from Excel or WhatsApp groups, and our team helps you set up batches and fees on a free onboarding call." },
              { q: "Can my coaches use it on their phone?", a: "Yes — SportsOS is mobile-first. Coaches mark attendance, add notes, and view their batches entirely from their phone. No app download required (PWA)." },
              { q: "What if my parents prefer paying in cash?", a: "You can record cash payments manually with one tap. The parent still gets a digital receipt and the fee status updates instantly." },
              { q: "Can I try it before committing?", a: "Yes — start a 14-day free trial with no card required. You can also click 'Experience Now' on this page to explore a demo academy instantly." },
              { q: "What sports does SportsOS support beyond cricket?", a: "Football, badminton, swimming, tennis, athletics, and martial arts academies use SportsOS. Cricket-specific modules (bowling speed, match stats) are optional add-ons." },
              { q: "How does WhatsApp integration work?", a: "We use the official WhatsApp Business API. Payment reminders, attendance alerts, and progress cards are sent from your verified academy number — no personal account needed." },
            ].map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contact" className="py-20 sm:py-28 gradient-hero">
        <Reveal direction="scale" className="container max-w-3xl text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-balance">
            Ready to run your academy <span className="text-primary">smarter?</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Join the academies already saving hours every week.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
              Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Link to="/app"><Button size="lg" variant="outline">Experience Now</Button></Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card/30">
        <div className="container grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground">Academy management, simplified.</p>
          </div>
          <div>
            <p className="font-display font-semibold text-sm mb-3">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><Link to="/app" className="hover:text-foreground">Live Demo</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-display font-semibold text-sm mb-3">Company</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#contact" className="hover:text-foreground">Contact</a></li>
              <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <p className="font-display font-semibold text-sm mb-3">Get in touch</p>
            <p className="text-sm text-muted-foreground">WhatsApp: +91 98XXX XXXXX</p>
            <p className="text-sm text-muted-foreground">hello@sportsos.in</p>
          </div>
        </div>
        <div className="container mt-8 pt-6 border-t border-border text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <p>© 2026 SportsOS by QRYX Tech. All rights reserved.</p>
          <p>Made with care for Indian sports academies.</p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/919999999999"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-glow hover:scale-105 transition-transform"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden group-hover:inline text-sm font-medium">Chat with us</span>
      </a>
    </div>
  );
};

const PricingTier = ({
  name, monthly, annual, annualToggle, features, cta, popular,
}: {
  name: string; monthly: number; annual: number; annualToggle: boolean;
  features: string[]; cta: string; popular?: boolean;
}) => {
  const price = annualToggle ? annual : monthly;
  const period = annualToggle ? "/year" : "/month";
  return (
    <div className={cn(
      "relative rounded-2xl border bg-card p-6 sm:p-8 flex flex-col",
      popular ? "border-primary/60 shadow-glow" : "border-border"
    )}>
      {popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-0">Most Popular</Badge>
      )}
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{name}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold">₹{price.toLocaleString("en-IN")}</span>
        <span className="text-muted-foreground text-sm">{period}</span>
      </div>
      <ul className="mt-6 space-y-2.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>
      <Button className={cn(
        "mt-7 w-full",
        popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-foreground hover:bg-muted/80"
      )}>
        {cta}
      </Button>
    </div>
  );
};

export default Landing;