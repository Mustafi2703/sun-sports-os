import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Case Study", href: "#case-study" },
  { label: "Contact", href: "#contact" },
];

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-border/60 glass" : "bg-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to="/"><Logo /></Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/app">
            <Button variant="outline" size="sm">Experience Now</Button>
          </Link>
          <Button variant="default" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow">
            Start Free Trial
          </Button>
        </div>

        <button className="md:hidden p-2 text-foreground" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card animate-fade-in">
          <div className="container py-4 flex flex-col gap-3">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-muted-foreground py-2">{l.label}</a>
            ))}
            <Link to="/app" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">Experience Now</Button>
            </Link>
            <Button className="w-full bg-primary text-primary-foreground">Start Free Trial</Button>
          </div>
        </div>
      )}
    </header>
  );
};