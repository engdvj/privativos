import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { useToast } from "@/components/ui/use-toast";
import { ShieldCheck } from "lucide-react";
import type { AuditoriaRow } from "../types";

export function AuditoriaTab() {
  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [limit, setLimit] = useState("100");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  const carregar = useCallback(async () => {
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
  }, [error, limit]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter((row) =>
      [row.operador, row.entidade, row.operacao, row.registroId].join(" ").toLowerCase().includes(termo),
    );
  }, [rows, busca]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Auditoria"
        icon={ShieldCheck}
        description={`Registros filtrados: ${filtrados.length}`}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <FormField label="Limite (1 a 500)" htmlFor="aud-limit">
            <Input
              id="aud-limit"
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </FormField>
          <FormField label="Busca" htmlFor="aud-busca" className="md:col-span-2">
            <Input
              id="aud-busca"
              placeholder="Operador, entidade, operacao ou registro"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </FormField>
        </div>

        <DataTable
          columns={[
            { key: "timestamp", title: "Data/Hora", className: "font-mono tabular-nums" },
            { key: "operador", title: "Operador" },
            { key: "entidade", title: "Entidade" },
            { key: "operacao", title: "Operacao", align: "center" },
            { key: "registro", title: "Registro", align: "center", className: "font-mono tabular-nums" },
          ]}
          rows={filtrados}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyMessage="Nenhum registro de auditoria encontrado."
          minWidthClassName="min-w-[900px]"
          renderRow={(row) => (
            <>
              <td>{new Date(row.timestamp).toLocaleString()}</td>
              <td>{row.operador}</td>
              <td>{row.entidade}</td>
              <td>{row.operacao}</td>
              <td>{row.registroId}</td>
            </>
          )}
        />
      </SectionCard>
    </div>
  );
}
