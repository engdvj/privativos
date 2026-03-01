import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Package,
  RefreshCw,
  Undo2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import {
  type OperacaoMonitorEvent,
  type MonitorResumoData,
  readLastOperacaoMonitorEvent,
  subscribeOperacaoMonitor,
} from "@/lib/operacao-monitor";

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function tipoLabel(tipo: "emprestimo" | "devolucao") {
  return tipo === "emprestimo" ? "Emprestimo" : "Devolucao";
}

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
  const Icon = data.tipo === "emprestimo" ? Package : Undo2;

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
      <div className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/12">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h3 className="mt-2 text-lg font-bold text-foreground">Resumo para confirmacao</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Revise os dados antes da confirmacao na tela principal.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-surface-1/92 p-3">
        <dl className="space-y-2">
          <div className="flex items-center justify-between">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Operacao
            </dt>
            <dd>
              <StatusPill tone="info">{tipoLabel(data.tipo)}</StatusPill>
            </dd>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Funcionario
            </dt>
            <dd className="truncate text-sm font-semibold text-foreground">{data.funcionarioNome}</dd>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Matricula
            </dt>
            <dd className="font-mono text-sm font-semibold text-foreground">{data.matricula}</dd>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Unidade
            </dt>
            <dd className="truncate text-sm font-semibold text-foreground">{data.funcionarioUnidade || "-"}</dd>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Setor
            </dt>
            <dd className="truncate text-sm font-semibold text-foreground">{data.funcionarioSetor}</dd>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Quantidade
            </dt>
            <dd>
              <StatusPill tone="warning">{data.quantidade}</StatusPill>
            </dd>
          </div>
          {data.tipo === "emprestimo" && data.selecoes && data.selecoes.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-1">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Pedido
                </dt>
                <dd className="space-y-1">
                  {data.selecoes.map((row) => (
                    <div
                      key={`${row.tipo}-${row.tamanho}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-2 py-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill tone="neutral">{row.tipo}</StatusPill>
                        <StatusPill tone="neutral">{row.tamanho}</StatusPill>
                      </div>
                      <StatusPill tone="info">{row.quantidade}</StatusPill>
                    </div>
                  ))}
                </dd>
              </div>
            </>
          ) : null}
          {data.tipo === "emprestimo" && !data.selecoes?.length && data.tipo_item ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tipo
                </dt>
                <dd>
                  <StatusPill tone="neutral">{data.tipo_item}</StatusPill>
                </dd>
              </div>
            </>
          ) : null}
          {data.tipo === "emprestimo" && !data.selecoes?.length && data.tamanho ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tamanho
                </dt>
                <dd>
                  <StatusPill tone="neutral">{data.tamanho}</StatusPill>
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function ResultadoState({
  event,
}: {
  event: Extract<OperacaoMonitorEvent, { kind: "resultado" }>;
}) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 text-center animate-in fade-in-0 zoom-in-95">
      <div className="flex justify-center">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl border shadow-[0_16px_30px_-22px_hsl(210_42%_18%_/_0.65)]",
            event.data.sucesso
              ? "border-success/30 bg-success/12"
              : "border-destructive/30 bg-destructive/12",
          )}
        >
          {event.data.sucesso ? (
            <CheckCircle2 className="h-7 w-7 text-success" />
          ) : (
            <XCircle className="h-7 w-7 text-destructive" />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-foreground">
          {event.data.sucesso ? "Operacao concluida" : "Falha na operacao"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{event.data.mensagem}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        <StatusPill tone={event.data.sucesso ? "success" : "danger"}>
          {tipoLabel(event.data.tipo)}
        </StatusPill>
        <StatusPill tone="info">{event.data.itens.length} item(ns)</StatusPill>
      </div>

      <div className="rounded-xl border border-border/70 bg-surface-1/92 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {event.data.tipo === "emprestimo" ? "Itens emprestados" : "Itens devolvidos"}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {event.data.itens.map((item) => (
            <StatusPill key={item} tone="neutral" className="font-mono text-[10px]">
              {item}
            </StatusPill>
          ))}
          {event.data.itens.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item retornado.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusTrilha({ event }: { event: OperacaoMonitorEvent }) {
  const active = event.kind;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-2 rounded-2xl border border-border/70 bg-gradient-to-r from-surface-2/95 via-background/92 to-surface-2/95 p-1.5 shadow-sm sm:grid-cols-3">
      <div
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
          active === "waiting"
            ? "border-primary/30 bg-primary/12 text-primary"
            : "border-transparent text-muted-foreground",
        )}
      >
        <CircleDashed className="h-4 w-4" />
        Em espera
      </div>
      <div
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
          active === "resumo"
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-transparent text-muted-foreground",
        )}
      >
        <Clock3 className="h-4 w-4" />
        Resumo
      </div>
      <div
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
          active === "resultado"
            ? event.kind === "resultado" && event.data.sucesso
              ? "border-success/35 bg-success/12 text-success"
              : "border-destructive/35 bg-destructive/12 text-destructive"
            : "border-transparent text-muted-foreground",
        )}
      >
        {event.kind === "resultado" && !event.data.sucesso ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Resultado
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

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background animate-in fade-in-0">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/22 to-secondary/50 dark:from-background dark:via-primary/8 dark:to-accent/18" />
        <div className="absolute -left-20 top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-primary/24 blur-[128px] animate-drift-slower" />
        <div className="absolute right-[-11rem] bottom-[-11rem] h-[33rem] w-[33rem] rounded-full bg-secondary/72 blur-[136px] animate-drift-slow dark:bg-accent/26" />
        <div className="absolute left-[48%] top-[9%] h-44 w-44 rounded-full bg-primary/18 blur-[90px] animate-drift-slow" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <Card className="w-full border-border/80 bg-card/95 shadow-[0_30px_60px_-34px_hsl(200_76%_20%_/_0.65)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
          <CardHeader className="gap-2 border-b border-border/65 bg-gradient-to-r from-primary/8 via-transparent to-accent/14 px-4 pb-4 pt-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/28 bg-gradient-to-br from-primary/18 via-background to-accent/45 p-2.5 shadow-[0_10px_26px_-18px_hsl(198_68%_24%_/_0.68)]">
                  <img src="/logo-privativos.png" alt="Privativos" className="h-full w-full rounded-lg object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Privativos
                  </p>
                  <CardTitle className="text-lg font-bold sm:text-2xl">Acompanhamento da operacao</CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Monitoramento em tempo real da triagem operacional.
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone={status.tone} className="text-[10px]">{status.label}</StatusPill>
                <StatusPill tone="neutral" className="text-[10px]">Atualizado em: {formatTimestamp(event.timestamp)}</StatusPill>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
            <StatusTrilha event={event} />

            <Card className="border-border/70 bg-background/65 shadow-[var(--shadow-soft)]">
              <CardContent className="px-3 pb-4 pt-4 sm:px-4 sm:pb-5">
                {event.kind === "waiting" ? <WaitingState mensagem={event.mensagem} /> : null}
                {event.kind === "resumo" ? <ResumoState data={event.data} /> : null}
                {event.kind === "resultado" ? <ResultadoState event={event} /> : null}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Sincronizacao automatica ativa
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
