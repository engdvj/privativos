import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Loader2, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import type { ConfiguracaoRow } from "../types";
export function ConfiguracoesTab() {
  const [rows, setRows] = useState<ConfiguracaoRow[]>([]);
  const [maxKits, setMaxKits] = useState("2");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  async function carregar() {
    setLoading(true);
    try {
      const data = await api.get<ConfiguracaoRow[]>("/admin/configuracoes");
      setRows(data);
      const atual = data.find((row) => row.chave === "MAX_KITS_POR_FUNCIONARIO");
      if (atual?.valor) {
        setMaxKits(atual.valor);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar configuracoes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvarMaxKits() {
    const valor = Number(maxKits);
    if (!Number.isInteger(valor) || valor <= 0) {
      error("MAX_KITS_POR_FUNCIONARIO deve ser inteiro positivo");
      return;
    }

    setSaving(true);
    try {
      await api.put("/admin/configuracoes/max-kits", {
        max_kits_por_funcionario: valor,
      });
      success("Configuracao atualizada");
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar configuracao");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">MAX_KITS_POR_FUNCIONARIO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="max-kits">Valor</Label>
              <Input
                id="max-kits"
                type="number"
                min={1}
                value={maxKits}
                onChange={(e) => setMaxKits(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
            <Button onClick={salvarMaxKits} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Outras Configuracoes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Chave</th>
                <th className="p-2">Valor</th>
                <th className="p-2">Atualizado por</th>
                <th className="p-2">Atualizado em</th>
                <th className="p-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.chave} className="border-b">
                  <td className="p-2 font-mono">{row.chave}</td>
                  <td className="p-2">{row.valor}</td>
                  <td className="p-2">{row.atualizadoPor ?? "-"}</td>
                  <td className="p-2">{row.atualizadoEm ? new Date(row.atualizadoEm).toLocaleString() : "-"}</td>
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


