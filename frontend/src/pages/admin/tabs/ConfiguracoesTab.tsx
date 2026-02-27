import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TableActions } from "@/components/ui/table-actions";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, Save, Settings2 } from "lucide-react";
import type { ConfiguracaoRow } from "../types";

const MAX_KITS_KEY = "MAX_KITS_POR_FUNCIONARIO";

export function ConfiguracoesTab() {
  const [rows, setRows] = useState<ConfiguracaoRow[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [maxKits, setMaxKits] = useState("2");
  const { success, error } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ConfiguracaoRow[]>("/admin/configuracoes");
      setRows(data);
      const atual = data.find((row) => row.chave === MAX_KITS_KEY);
      if (atual?.valor) {
        setMaxKits(atual.valor);
      }
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao carregar configuracoes");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter((row) => {
      if (!termo) return true;
      return [row.chave, row.valor, row.atualizadoPor ?? ""].join(" ").toLowerCase().includes(termo);
    });
  }, [rows, busca]);

  async function salvarMaxKits() {
    const valor = Number(maxKits);
    if (!Number.isInteger(valor) || valor <= 0) {
      error(`${MAX_KITS_KEY} deve ser inteiro positivo`);
      return;
    }

    setSaving(true);
    try {
      await api.put("/admin/configuracoes/max-kits", {
        max_kits_por_funcionario: valor,
      });
      success("Configuracao atualizada");
      setOpenEditModal(false);
      await carregar();
    } catch (err) {
      error(err instanceof Error ? err.message : "Erro ao salvar configuracao");
    } finally {
      setSaving(false);
    }
  }

  function abrirEdicao(row: ConfiguracaoRow) {
    if (row.chave !== MAX_KITS_KEY) return;
    setMaxKits(row.valor || "1");
    setOpenEditModal(true);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Configuracoes"
        icon={Settings2}
        description={`Total filtrado: ${rowsFiltradas.length}`}
        actions={
          <FilterBar>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar chave, valor ou operador"
              className="h-9 w-full sm:w-56"
            />
          </FilterBar>
        }
      >
        <DataTable
          columns={[
            { key: "chave", title: "Chave", className: "font-mono font-semibold" },
            { key: "valor", title: "Valor", align: "center", className: "font-mono tabular-nums" },
            { key: "tipo", title: "Tipo", align: "center" },
            { key: "atualizado-por", title: "Atualizado por" },
            { key: "atualizado-em", title: "Atualizado em", className: "font-mono tabular-nums" },
            { key: "acoes", title: "Acoes", align: "center" },
          ]}
          rows={rowsFiltradas}
          getRowKey={(row) => row.chave}
          loading={loading}
          emptyMessage="Nenhuma configuracao encontrada."
          minWidthClassName="min-w-[980px]"
          renderRow={(row) => {
            const isEditavel = row.chave === MAX_KITS_KEY;

            return (
              <>
                <td>{row.chave}</td>
                <td>{row.valor}</td>
                <td>
                  <div className="flex justify-center">
                    <StatusPill tone={isEditavel ? "success" : "neutral"}>
                      {isEditavel ? "editavel" : "somente leitura"}
                    </StatusPill>
                  </div>
                </td>
                <td>{row.atualizadoPor ?? "-"}</td>
                <td>{row.atualizadoEm ? new Date(row.atualizadoEm).toLocaleString() : "-"}</td>
                <td>
                  <TableActions className="justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => abrirEdicao(row)}
                      disabled={!isEditavel}
                      aria-label={`Editar configuracao ${row.chave}`}
                      title={isEditavel ? "Editar" : "Somente leitura"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableActions>
                </td>
              </>
            );
          }}
        />
      </SectionCard>

      <Modal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        title={`Editar Configuracao: ${MAX_KITS_KEY}`}
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-3">
          <FormField
            label="Valor"
            htmlFor="max-kits"
            helperText="Informe um inteiro positivo para limitar kits por funcionario."
          >
            <Input
              id="max-kits"
              type="number"
              min={1}
              value={maxKits}
              onChange={(e) => setMaxKits(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end">
            <Button onClick={salvarMaxKits} loading={saving}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
