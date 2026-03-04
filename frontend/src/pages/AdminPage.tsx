import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Database,
  IdCard,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCog,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardTab } from "./admin/tabs/DashboardTab";
import { FuncionariosTab } from "./admin/tabs/FuncionariosTab";
import { UnidadesTab } from "./admin/tabs/UnidadesTab";
import { SetoresTab } from "./admin/tabs/SetoresTab";
import { FuncoesTab } from "./admin/tabs/FuncoesTab";
import { ItensTab } from "./admin/tabs/ItensTab";
import { CredenciaisTab } from "./admin/tabs/CredenciaisTab";
import { AuditoriaTab } from "./admin/tabs/AuditoriaTab";
import { ConfiguracoesTab } from "./admin/tabs/ConfiguracoesTab";
import { ManutencaoTab } from "./admin/tabs/ManutencaoTab";

const SIDEBAR_MIN_WIDTH = 184;
const SIDEBAR_MAX_WIDTH = 344;
const SIDEBAR_DEFAULT_WIDTH = 248;
const SIDEBAR_COLLAPSED_WIDTH = 78;
const SIDEBAR_COLLAPSE_THRESHOLD = Math.round((SIDEBAR_MIN_WIDTH + SIDEBAR_COLLAPSED_WIDTH) / 2);

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));
}

export function AdminPage() {
  const perfil = api.getPerfil();
  const isSuperadmin = perfil === "superadmin";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mountedTabs, setMountedTabs] = useState<string[]>(["dashboard"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarExpandedWidth, setSidebarExpandedWidth] = useState(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
    const saved = Number(localStorage.getItem("admin-sidebar-width"));
    if (!Number.isFinite(saved)) return SIDEBAR_DEFAULT_WIDTH;
    return clampSidebarWidth(saved);
  });
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const isIconOnly = sidebarCollapsed;
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarExpandedWidth;

  const menuSections = useMemo(
    () => [
      {
        title: "Operacao",
        items: [
          {
            id: "dashboard",
            label: "Dashboard",
            icon: BarChart3,
            iconClass: "text-primary",
          },
        ],
      },
      {
        title: "Cadastros",
        items: [
          {
            id: "funcionarios",
            label: "Funcionarios",
            icon: IdCard,
            iconClass: "text-foreground/85",
          },
          {
            id: "unidades",
            label: "Unidades",
            icon: Building2,
            iconClass: "text-foreground/85",
          },
          {
            id: "setores",
            label: "Setores",
            icon: Building2,
            iconClass: "text-foreground/85",
          },
          {
            id: "funcoes",
            label: "Funcoes",
            icon: UserCog,
            iconClass: "text-foreground/85",
          },
          {
            id: "itens",
            label: "Itens",
            icon: Boxes,
            iconClass: "text-foreground/85",
          },
        ],
      },
      ...(isSuperadmin
        ? [
            {
              title: "Seguranca",
              items: [
                {
                  id: "credenciais",
                  label: "Credenciais",
                  icon: KeyRound,
                  iconClass: "text-foreground/85",
                },
                {
                  id: "auditoria",
                  label: "Auditoria",
                  icon: ClipboardList,
                  iconClass: "text-foreground/85",
                },
                {
                  id: "configuracoes",
                  label: "Configuracoes",
                  icon: Settings,
                  iconClass: "text-foreground/85",
                },
                {
                  id: "manutencao",
                  label: "Manutencao",
                  icon: Database,
                  iconClass: "text-foreground/85",
                },
              ],
            },
          ]
        : []),
    ],
    [isSuperadmin],
  );

  const tabIds = menuSections.flatMap((section) => section.items.map((item) => item.id));
  const currentTab = tabIds.includes(activeTab) ? activeTab : tabIds[0] ?? "dashboard";

  useEffect(() => {
    setMountedTabs((previous) => (previous.includes(currentTab) ? previous : [...previous, currentTab]));
  }, [currentTab]);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  function startSidebarResize() {
    setResizingSidebar(true);
  }

  useEffect(() => {
    localStorage.setItem("admin-sidebar-width", String(sidebarExpandedWidth));
  }, [sidebarExpandedWidth]);

  useEffect(() => {
    if (!resizingSidebar) return;

    const onPointerMove = (event: MouseEvent) => {
      const nextWidth = event.clientX;

      if (nextWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setSidebarCollapsed(true);
        return;
      }

      setSidebarCollapsed(false);
      setSidebarExpandedWidth(clampSidebarWidth(nextWidth));
    };

    const onPointerUp = () => {
      setResizingSidebar(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
    };
  }, [resizingSidebar]);

  const layoutStyle = {
    ["--sidebar-width" as string]: `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Header />

      <main className="min-h-0 flex-1 overflow-hidden">
        <div
          className="grid h-full min-h-0 transition-[grid-template-columns] duration-300 ease-[var(--motion-ease-standard)] motion-reduce:transition-none md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
          style={layoutStyle}
        >
          <div className="relative h-full min-h-0">
            <aside className="relative flex h-full min-h-0 flex-col overflow-hidden border-r border-border/70 bg-gradient-to-b from-card/94 via-surface-2/88 to-card/92 backdrop-blur-xl transition-colors duration-200 dark:border-border/85 dark:from-card/88 dark:via-background/90 dark:to-card/86">
              <div className="relative z-[1] min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pt-4">
                {menuSections.map((section, sectionIndex) => (
                  <div
                    key={section.title}
                    className="animate-in fade-in-0"
                    style={{ animationDelay: `${sectionIndex * 34}ms` }}
                  >
                    <p
                      className={cn(
                        "mb-1.5 overflow-hidden px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-all duration-200 dark:text-white/70",
                        isIconOnly ? "max-h-0 opacity-0" : "max-h-5 opacity-100",
                      )}
                    >
                      {section.title}
                    </p>

                    <div className="space-y-1">
                      {section.items.map((item, itemIndex) => (
                        <Button
                          key={item.id}
                          variant="ghost"
                          className={cn(
                            "group relative h-9 w-full overflow-hidden rounded-xl border transition-all duration-200",
                            currentTab === item.id
                              ? "border-primary/35 bg-primary/14 !text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)] dark:border-primary/40 dark:bg-primary/22 dark:!text-white"
                              : "border-transparent bg-transparent text-foreground/88 hover:-translate-y-0.5 hover:border-primary/28 hover:!animate-none hover:!bg-primary/10 hover:!text-foreground dark:text-white/90 dark:hover:border-primary/35 dark:hover:!bg-primary/18 dark:hover:!text-white",
                            isIconOnly ? "justify-center px-2" : "justify-start px-2.5",
                          )}
                          onClick={() => setActiveTab(item.id)}
                          title={item.label}
                          aria-current={currentTab === item.id ? "page" : undefined}
                          style={{ animationDelay: `${(sectionIndex + itemIndex + 1) * 24}ms` }}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4 transition-all duration-200 group-hover:scale-105",
                              currentTab === item.id
                                ? "text-foreground dark:text-white"
                                : `${item.iconClass} group-hover:text-foreground dark:text-white/85 dark:group-hover:text-white`,
                            )}
                          />
                          <span
                            className={cn(
                              "origin-left overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200",
                              currentTab === item.id
                                ? "text-foreground dark:text-white"
                                : "group-hover:text-foreground dark:group-hover:text-white",
                              isIconOnly ? "max-w-0 -translate-x-1 opacity-0" : "max-w-[12rem] translate-x-0 opacity-100",
                            )}
                          >
                            {item.label}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
            <button
              type="button"
              aria-label="Arrastar para ajustar largura da barra lateral"
              className="absolute top-0 right-0 hidden h-full w-2 cursor-col-resize bg-transparent transition-colors hover:bg-primary/18 md:block"
              onMouseDown={startSidebarResize}
            />
          </div>

          <section className="min-h-0 min-w-0 overflow-y-auto p-3 md:p-4">
            {mountedTabs.includes("dashboard") ? (
              <div className={cn(currentTab === "dashboard" ? "block" : "hidden")}>
                <DashboardTab />
              </div>
            ) : null}
            {mountedTabs.includes("funcionarios") ? (
              <div className={cn(currentTab === "funcionarios" ? "block" : "hidden")}>
                <FuncionariosTab />
              </div>
            ) : null}
            {mountedTabs.includes("unidades") ? (
              <div className={cn(currentTab === "unidades" ? "block" : "hidden")}>
                <UnidadesTab />
              </div>
            ) : null}
            {mountedTabs.includes("setores") ? (
              <div className={cn(currentTab === "setores" ? "block" : "hidden")}>
                <SetoresTab />
              </div>
            ) : null}
            {mountedTabs.includes("funcoes") ? (
              <div className={cn(currentTab === "funcoes" ? "block" : "hidden")}>
                <FuncoesTab />
              </div>
            ) : null}
            {mountedTabs.includes("itens") ? (
              <div className={cn(currentTab === "itens" ? "block" : "hidden")}>
                <ItensTab />
              </div>
            ) : null}
            {isSuperadmin && mountedTabs.includes("credenciais") ? (
              <div className={cn(currentTab === "credenciais" ? "block" : "hidden")}>
                <CredenciaisTab />
              </div>
            ) : null}
            {isSuperadmin && mountedTabs.includes("auditoria") ? (
              <div className={cn(currentTab === "auditoria" ? "block" : "hidden")}>
                <AuditoriaTab />
              </div>
            ) : null}
            {isSuperadmin && mountedTabs.includes("configuracoes") ? (
              <div className={cn(currentTab === "configuracoes" ? "block" : "hidden")}>
                <ConfiguracoesTab />
              </div>
            ) : null}
            {isSuperadmin && mountedTabs.includes("manutencao") ? (
              <div className={cn(currentTab === "manutencao" ? "block" : "hidden")}>
                <ManutencaoTab />
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <Footer
        leading={(
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            aria-label={isIconOnly ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={isIconOnly ? "Expandir menu lateral" : "Recolher menu lateral"}
            className="h-7 w-7 rounded-lg"
          >
            {isIconOnly ? <PanelLeftOpen className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
          </Button>
        )}
      />
    </div>
  );
}
