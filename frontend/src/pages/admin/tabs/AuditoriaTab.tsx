import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { AuditoriaRow } from "../types";
export function AuditoriaTab() {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [limit, setLimit] = useState("100");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const data = await api.get<AuditoriaRow[]>(`/admin/auditoria?limit=${safeLimit}`);
      setRows(data);
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter((row) =>
      [row.operador, row.entidade, row.operacao, row.registroId].join(" ").toLowerCase().includes(termo),
    );
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="aud-limit">Limite (1 a 500)</Label>
              <Input
                id="aud-limit"
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="aud-busca">Busca</Label>
              <Input
                id="aud-busca"
                placeholder="Operador, entidade, operacao ou registro"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Registros ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Data/Hora</th>
                <th className="p-2">Operador</th>
                <th className="p-2">Entidade</th>
                <th className="p-2">Operacao</th>
                <th className="p-2">Registro</th>
                <th className="p-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{new Date(row.timestamp).toLocaleString()}</td>
                  <td className="p-2">{row.operador}</td>
                  <td className="p-2">{row.entidade}</td>
                  <td className="p-2">{row.operacao}</td>
                  <td className="p-2 font-mono">{row.registroId}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" disabled aria-label="Editar" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled aria-label="Apagar" title="Apagar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}


