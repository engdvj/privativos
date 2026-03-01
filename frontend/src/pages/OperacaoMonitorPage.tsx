import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Package,
  Undo2,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import {
  type OperacaoMonitorEvent,
  type MonitorResumoData,
  readLastOperacaoMonitorEvent,
  subscribeOperacaoMonitor,
} from "@/lib/operacao-monitor";

function WaitingState({ mensagem }: { mensagem: string }) {
  return (
    <div className="space-y-4 py-10 text-center animate-in fade-in-0">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/14 to-primary/6 shadow-[0_14px_32px_-22px_hsl(198_76%_28%_/_0.75)]">
        <Clock3 className="h-8 w-8 text-primary animate-pulse-slow" />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-foreground">Em espera</h3>
        <p className="text-sm text-muted-foreground">{mensagem}</p>
      </div>
    </div>
  );
}

function ResumoState({ data }: { data: MonitorResumoData }) {
  const isEmprestimo = data.tipo === "emprestimo";
  const Icon = data.tipo === "emprestimo" ? Package : Undo2;
  const selecoesResumo =
    data.selecoes && data.selecoes.length > 0
      ? data.selecoes
      : data.tipo_item
        ? [{ tipo: data.tipo_item, tamanho: data.tamanho ?? "-", quantidade: data.quantidade || 1 }]
        : [];

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {isEmprestimo ? "Confirmar Solicitacao" : "Confirmar Devolucao"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Revise os dados antes da confirmacao na tela principal.
        </p>
      </div>

      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-border/70 bg-surface-2/60">
          <div className="border-b border-border px-4 py-2.5">
            <h4 className="text-sm font-semibold text-foreground">Dados do usuario</h4>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Funcionario</span>
              <span className="truncate text-sm font-semibold text-foreground">{data.funcionarioNome}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Matricula</span>
              <span className="font-mono text-sm font-semibold text-foreground">{data.matricula}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Unidade</span>
              <span className="truncate text-sm font-semibold text-foreground">{data.funcionarioUnidade || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Setor</span>
              <span className="truncate text-sm font-semibold text-foreground">{data.funcionarioSetor || "-"}</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-surface-2/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              {isEmprestimo ? "Pedido" : "Itens para devolucao"}
            </h4>
            <StatusPill tone="info">
              {data.quantidade} {data.quantidade === 1 ? "item" : "itens"}
            </StatusPill>
          </div>

          {isEmprestimo ? (
            selecoesResumo.length > 0 ? (
              <div className="max-h-40 divide-y divide-border overflow-y-auto rounded-xl border border-border/70 bg-background">
                {selecoesResumo.map((row) => (
                  <div
                    key={`${row.tipo}-${row.tamanho}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill tone="neutral">{row.tipo}</StatusPill>
                      <StatusPill tone="neutral">{row.tamanho}</StatusPill>
                    </div>
                    <StatusPill tone="info" className="tabular-nums">
                      {row.quantidade}
                    </StatusPill>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background p-3 text-center">
                <p className="text-sm text-muted-foreground">Nenhum item no pedido.</p>
              </div>
            )
          ) : data.itens.length > 0 ? (
            <div className="max-h-40 divide-y divide-border overflow-y-auto rounded-xl border border-border/70 bg-background">
              {data.itens.map((item) => (
                <div key={item.codigo} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="info" className="font-mono">{item.codigo}</StatusPill>
                    {item.tipo ? <StatusPill tone="neutral">{item.tipo}</StatusPill> : null}
                    {item.tamanho ? <StatusPill tone="neutral">{item.tamanho}</StatusPill> : null}
                    <StatusPill tone="info">1</StatusPill>
                  </div>
                  {item.descricao ? (
                    <p className="truncate text-sm text-muted-foreground">{item.descricao}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-background p-3 text-center">
              <p className="text-sm text-muted-foreground">Nenhum item no pedido.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ResultadoState({
  event,
}: {
  event: Extract<OperacaoMonitorEvent, { kind: "resultado" }>;
}) {
  const isEmprestimo = event.data.tipo === "emprestimo";

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 text-center animate-in fade-in-0 zoom-in-95">
      <div className="flex justify-center">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border",
            event.data.sucesso
              ? "border-success/30 bg-success/10"
              : "border-border/70 bg-muted/45",
          )}
        >
          {event.data.sucesso ? (
            <CheckCircle2 className="h-6 w-6 text-success" />
          ) : (
            <XCircle className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-foreground">
          {event.data.sucesso
            ? isEmprestimo
              ? "Solicitacao realizada"
              : "Devolucao realizada"
            : "Operacao cancelada"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {event.data.sucesso
            ? isEmprestimo
              ? "A solicitacao foi confirmada com sucesso."
              : "A devolucao foi confirmada com sucesso."
            : "A operacao foi cancelada e nenhuma alteracao foi realizada."}
        </p>
      </div>
    </div>
  );
}

export function OperacaoMonitorPage() {
  const [event, setEvent] = useState<OperacaoMonitorEvent>(() => {
    const last = readLastOperacaoMonitorEvent();
    if (last) return last;
    return {
      kind: "waiting",
      timestamp: new Date().toISOString(),
      mensagem: "Aguardando uma operacao na tela principal.",
    };
  });
  const lastEventRef = useRef<string>(JSON.stringify(event));

  useEffect(() => {
    const applyEvent = (nextEvent: OperacaoMonitorEvent) => {
      const serialized = JSON.stringify(nextEvent);
      if (serialized === lastEventRef.current) return;
      lastEventRef.current = serialized;
      setEvent(nextEvent);
    };

    const unsubscribe = subscribeOperacaoMonitor(applyEvent);

    const pollId = window.setInterval(() => {
      const latest = readLastOperacaoMonitorEvent();
      if (latest) {
        applyEvent(latest);
      }
    }, 450);

    return () => {
      unsubscribe();
      window.clearInterval(pollId);
    };
  }, []);

  const status = useMemo(() => {
    if (event.kind === "resumo") {
      return { tone: "info" as const, label: "Aguardando confirmacao" };
    }
    if (event.kind === "resultado") {
      return event.data.sucesso
        ? { tone: "success" as const, label: "Operacao concluida" }
        : { tone: "danger" as const, label: "Falha na operacao" };
    }
    return { tone: "info" as const, label: "Tela de espera" };
  }, [event]);

  const isResultado = event.kind === "resultado";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background animate-in fade-in-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/20 to-secondary/42 dark:from-background dark:via-primary/8 dark:to-accent/18" />
        <div className="absolute -left-20 top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-primary/24 blur-[128px] animate-drift-slower" />
        <div className="absolute right-[-11rem] bottom-[-11rem] h-[33rem] w-[33rem] rounded-full bg-secondary/68 blur-[136px] animate-drift-slow dark:bg-accent/26" />
      </div>

      <main
        className={cn(
          "relative mx-auto flex min-h-dvh w-full max-w-[1320px] justify-center px-6",
          isResultado ? "items-center py-6" : "items-start py-10 sm:py-12",
        )}
      >
        {isResultado ? (
          <div className="w-full max-w-5xl">
            <Card className="border-border/70 bg-card/95 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2">
              <CardContent className="p-6">
                <ResultadoState event={event} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="w-full">
            <section className="grid grid-cols-12 gap-6">
              <div className="col-span-12 flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-foreground">Acompanhamento da operacao</h1>
                  <p className="text-sm text-muted-foreground">
                    Monitoramento em tempo real da triagem operacional.
                  </p>
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
            </section>

            <section className="mt-6 grid grid-cols-12 gap-6">
              <div className="col-span-12 flex justify-center">
                <Card className="w-full max-w-5xl border-border/70 bg-card/95 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2">
                  <CardContent className="space-y-6 p-6">
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-foreground">Painel em tempo real</h2>
                      <p className="text-sm text-muted-foreground">
                        O painel reflete automaticamente os eventos da tela de operacoes.
                      </p>
                    </div>

                    <div className="mx-auto w-full max-w-xl rounded-xl border border-border/70 bg-background/65 p-4">
                      {event.kind === "waiting" ? <WaitingState mensagem={event.mensagem} /> : null}
                      {event.kind === "resumo" ? <ResumoState data={event.data} /> : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
