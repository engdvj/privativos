import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function Header() {
  const navigate = useNavigate();
  const nome = api.getNome();

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    api.clearSession();
    navigate("/");
  }

  return (
    <header className="flex items-center justify-between bg-[hsl(213,50%,23%)] px-6 py-3 text-white">
      <h1 className="text-lg font-semibold">Reunir V2</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm">{nome}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:text-white/80 hover:bg-white/10">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
