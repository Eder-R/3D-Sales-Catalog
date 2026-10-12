import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { Cube, Package, Envelope, SignOut, ArrowSquareOut } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/orcamentos", label: "Orçamentos", icon: Envelope },
];

export const AdminLayout = ({ children }) => {
  const { admin, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-mono text-sm">Carregando…</div>;
  if (!admin) return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/admin/produtos" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
                <Cube size={18} weight="fill" />
              </div>
              <span className="font-heading font-black text-base tracking-tight">FORJA 3D</span>
              <span className="overline-label text-[10px] hidden sm:inline">Admin</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  data-testid={`admin-nav-${l.label.toLowerCase()}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`
                  }
                >
                  <l.icon size={17} weight="duotone" /> {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.open("/", "_blank")} className="hidden sm:flex rounded-md text-muted-foreground">
              <ArrowSquareOut size={16} className="mr-1.5" /> Ver site
            </Button>
            <span className="text-sm text-muted-foreground font-mono hidden md:inline">{admin.username}</span>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/admin"); }} data-testid="admin-logout" className="rounded-md border-border">
              <SignOut size={16} className="mr-1.5" /> Sair
            </Button>
          </div>
        </div>
        <nav className="sm:hidden flex border-t border-border">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium ${isActive ? "text-foreground border-b-2 border-primary" : "text-muted-foreground"}`
              }
            >
              <l.icon size={17} weight="duotone" /> {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
};
