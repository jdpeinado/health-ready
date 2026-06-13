import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { useLogin } from "./useAuth";
import { ApiError } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate("/");
    } catch {
      /* error shown below */
    }
  }

  const message =
    login.error instanceof ApiError && login.error.status === 401
      ? "Email o contraseña incorrectos"
      : login.error
        ? "No se pudo iniciar sesión"
        : null;

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card/40 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(40rem 40rem at 70% 10%, oklch(0.77 0.158 62 / 0.18), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
            <Dumbbell
              className="size-6 text-primary-foreground"
              strokeWidth={2.5}
            />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            Health<span className="text-primary">Ready</span>
          </span>
        </div>

        <div className="relative space-y-4">
          <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight">
            Registra cada
            <br />
            <span className="text-primary">repetición.</span>
          </h1>
          <p className="max-w-sm text-muted-foreground">
            Tu bitácora de entrenamiento. Series, cargas y progreso — todo en un
            solo lugar, a tu ritmo.
          </p>
        </div>

        <p className="relative font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Entrena · Registra · Progresa
        </p>
      </aside>

      {/* Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-rise space-y-8">
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
                <Dumbbell
                  className="size-5 text-primary-foreground"
                  strokeWidth={2.5}
                />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">
                Health<span className="text-primary">Ready</span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="eyebrow">Bienvenido de vuelta</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">
              Entrar
            </h2>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {message && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
