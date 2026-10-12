import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Cube, List, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Início", end: true },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/orcamento", label: "Orçamento" },
];

export const SiteLayout = ({ children }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group" data-testid="logo-link">
            <div className="flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground">
              <Cube size={22} weight="fill" />
            </div>
            <div className="leading-none">
              <span className="font-heading font-black text-lg tracking-tight">FORJA 3D</span>
              <span className="block overline-label text-[10px] mt-0.5">Impressão PLA</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 hover:text-foreground ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Button
              onClick={() => navigate("/orcamento")}
              data-testid="header-quote-cta"
              className="rounded-md font-medium"
            >
              Solicitar Orçamento
            </Button>
          </nav>

          <button
            className="md:hidden text-foreground"
            onClick={() => setOpen(!open)}
            data-testid="mobile-menu-toggle"
            aria-label="Menu"
          >
            {open ? <X size={26} /> : <List size={26} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-border bg-card px-6 py-4 flex flex-col gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `text-base font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Button onClick={() => { setOpen(false); navigate("/orcamento"); }} className="rounded-md w-full">
              Solicitar Orçamento
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border mt-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
                <Cube size={18} weight="fill" />
              </div>
              <span className="font-heading font-black text-base tracking-tight">FORJA 3D</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Peças em PLA impressas sob demanda. Catálogo de projetos e orçamentos para peças personalizadas.
            </p>
          </div>
          <div>
            <h4 className="overline-label mb-4">Navegação</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {navItems.map((i) => (
                <li key={i.to}>
                  <Link to={i.to} className="hover:text-foreground transition-colors duration-200">{i.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="overline-label mb-4">Administração</h4>
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200" data-testid="footer-admin-link">
              Área administrativa
            </Link>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 text-xs text-muted-foreground font-mono">
            © {new Date().getFullYear()} Forja 3D — Impressão 3D em PLA.
          </div>
        </div>
      </footer>
    </div>
  );
};
