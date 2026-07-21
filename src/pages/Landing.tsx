import { Link } from "react-router-dom";
import {
  ArrowRight, MessageCircle, CalendarCheck, CreditCard, TrendingUp,
  Users, MapPin, Phone, ShieldCheck, StickyNote,
} from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Reveal } from "@/components/landing/Reveal";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const WHATSAPP = "https://wa.me/919033002641";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* Hero — brand first, parent-facing */}
      <section className="relative min-h-[100dvh] flex items-end sm:items-center pt-20 pb-16 sm:pb-24 overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_70%_-10%,hsl(142_71%_45%/0.22),transparent_55%),radial-gradient(900px_500px_at_0%_40%,hsl(217_91%_60%/0.12),transparent_50%),linear-gradient(180deg,hsl(225_47%_8%)_0%,hsl(222_39%_10%)_55%,hsl(225_47%_8%)_100%)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />
        <div className="container relative z-10 max-w-4xl">
          <p className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-in">
            Sun<span className="text-primary">Sports</span>
          </p>
          <p
            className="mt-2 text-sm sm:text-base text-muted-foreground tracking-wide uppercase animate-fade-in"
            style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
          >
            High Performance Cricket · Ahmedabad
          </p>
          <h1
            className="mt-8 font-display text-2xl sm:text-3xl lg:text-4xl font-semibold leading-snug text-balance max-w-2xl animate-fade-in"
            style={{ animationDelay: "160ms", animationFillMode: "backwards" }}
          >
            Your child’s academy updates — fees, attendance, and progress — in one place.
          </h1>
          <p
            className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl animate-fade-in"
            style={{ animationDelay: "240ms", animationFillMode: "backwards" }}
          >
            Sign in to the parent portal with the WhatsApp number registered at Sun Sports.
          </p>
          <div
            className="mt-8 flex flex-col sm:flex-row gap-3 animate-fade-in"
            style={{ animationDelay: "320ms", animationFillMode: "backwards" }}
          >
            <Link to="/parent/login">
              <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
                Parent portal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href={WHATSAPP} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-border">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp academy
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* For parents */}
      <section id="parents" className="py-20 sm:py-28 border-t border-border">
        <div className="container">
          <Reveal className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">
              Built for Sun Sports parents
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you used to ask over calls — now available anytime on your phone.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {[
              {
                icon: CreditCard,
                title: "Fee status",
                desc: "See dues, payment history, and clear reminders when fees are pending.",
              },
              {
                icon: CalendarCheck,
                title: "Attendance",
                desc: "30-day calendar of present, late, and absent sessions for your child.",
              },
              {
                icon: TrendingUp,
                title: "Performance",
                desc: "Batting, bowling, fielding, fitness, and temperament scores from coaches.",
              },
              {
                icon: StickyNote,
                title: "Coach notes",
                desc: "Read feedback as soon as coaches post updates on the dashboard.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80} className="space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold text-lg">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Training */}
      <section id="training" className="py-20 sm:py-28 bg-card/40 border-y border-border">
        <div className="container">
          <Reveal className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">
              High Performance training
            </h2>
            <p className="mt-3 text-muted-foreground">
              Structured cricket coaching across age groups — with coaches assigned to every batch.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-10">
            {[
              { title: "Batches by age & level", desc: "From younger groups to High Performance — schedules and venues stay clear in your portal." },
              { title: "Dedicated coaches", desc: "Know who is coaching your child and see notes after sessions and assessments." },
              { title: "Tournaments & match work", desc: "When your child is selected, fixtures and updates appear alongside their progress." },
            ].map(({ title, desc }, i) => (
              <Reveal key={title} delay={i * 100} className="space-y-2">
                <p className="text-xs font-medium text-primary tracking-wide uppercase">0{i + 1}</p>
                <h3 className="font-display font-semibold text-xl">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Portals — parent primary, others secondary */}
      <section id="portals" className="py-20 sm:py-28">
        <div className="container">
          <Reveal className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">
              Sign in to your portal
            </h2>
            <p className="mt-3 text-muted-foreground">
              Use the same 10-digit mobile number registered with the academy. Demo PIN is shared by the office.
            </p>
          </Reveal>

          <Reveal className="rounded-2xl border border-primary/40 bg-primary/10 p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-xl">Parent portal</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-md">
                    Fees, attendance calendar, performance scores, and coach notes for your child.
                  </p>
                </div>
              </div>
              <Link to="/parent/login" className="shrink-0">
                <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                  Parent login <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            <Reveal delay={80} className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold">Coach portal</h3>
                <p className="mt-1 text-sm text-muted-foreground">Attendance, assessments, and notes for assigned batches.</p>
              </div>
              <Link to="/coach/login">
                <Button variant="outline" className="w-full sm:w-auto">Coach login</Button>
              </Link>
            </Reveal>
            <Reveal delay={120} className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold">Internal team</h3>
                <p className="mt-1 text-sm text-muted-foreground">Academy staff console for students, fees, and tournaments.</p>
              </div>
              <Link to="/app/login">
                <Button variant="outline" className="w-full sm:w-auto">Team login</Button>
              </Link>
            </Reveal>
          </div>

          <Reveal className="mt-8 flex items-start gap-2 text-xs text-muted-foreground max-w-xl">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              Access is role-based. Parents only see their children. Coaches only see their batches.
              Contact the academy if your number is not linked yet.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 sm:py-28 border-t border-border gradient-hero">
        <Reveal className="container max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-balance">
            Talk to Sun Sports
          </h2>
          <p className="mt-3 text-muted-foreground">
            Admissions, fee queries, or portal help — WhatsApp the academy office.
          </p>
          <div className="mt-8 space-y-4 text-sm">
            <p className="flex items-center gap-3 text-foreground">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <a href="tel:+919033002641" className="hover:text-primary transition-colors">+91 90330 02641</a>
            </p>
            <p className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              High Performance cricket academy · Ahmedabad
            </p>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href={WHATSAPP} target="_blank" rel="noreferrer">
              <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp us
              </Button>
            </a>
            <Link to="/parent/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Open parent portal
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-10 bg-card/30">
        <div className="container flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-muted-foreground">Sun Sports SportsOS — academy portal for parents & coaches.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/parent/login" className="hover:text-foreground">Parent</Link>
            <Link to="/coach/login" className="hover:text-foreground">Coach</Link>
            <Link to="/app/login" className="hover:text-foreground">Team</Link>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="hover:text-foreground">WhatsApp</a>
          </div>
        </div>
        <div className="container mt-8 pt-6 border-t border-border text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sun Sports · Built by QRYX Tech
        </div>
      </footer>

      <a
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-glow hover:scale-105 transition-transform text-sm font-medium"
        aria-label="WhatsApp Sun Sports"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
    </div>
  );
};

export default Landing;
