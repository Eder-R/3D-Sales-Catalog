import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Cube } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const BG =
  "https://images.unsplash.com/photo-1625838144804-300f3907c110?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwd29ya3NwYWNlJTIwZGFya3xlbnwwfHx8fDE3OTE3NjczOTR8MA&ixlib=rb-4.1.0&q=85";

export default function AdminLogin() {
  const { admin, login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && admin) return <Navigate to="/admin/produtos" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/admin/produtos");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha no login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block border-r border-border">
        <img src={BG} alt="" className="h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 p-12">
          <span className="overline-label">Área restrita</span>
          <h2 className="mt-3 font-heading font-black text-3xl tracking-tight max-w-sm">Gerencie o catálogo da Forja 3D.</h2>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground">
              <Cube size={22} weight="fill" />
            </div>
            <span className="font-heading font-black text-lg tracking-tight">FORJA 3D</span>
          </div>
          <h1 className="font-heading font-bold text-2xl mb-2">Entrar na administração</h1>
          <p className="text-sm text-muted-foreground mb-8">Acesso exclusivo para gestão de produtos e orçamentos.</p>

          <form onSubmit={submit} className="space-y-5" data-testid="admin-login-form">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} data-testid="login-username" className="bg-background border-border rounded-md h-11" autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" className="bg-background border-border rounded-md h-11" autoComplete="current-password" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full rounded-md" data-testid="login-submit">
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
