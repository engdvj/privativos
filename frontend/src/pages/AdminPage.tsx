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

const SIDEBAR_MIN_WIDTH = 216;
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
            <aside className="flex h-full min-h-0 flex-col border-r border-border/70 bg-gradient-to-b from-card/94 via-surface-2/88 to-card/92 backdrop-blur-xl transition-colors duration-200 dark:border-border/85 dark:from-card/88 dark:via-background/90 dark:to-card/86">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 pt-4">
                {menuSections.map((section, sectionIndex) => (
                  <div
                    key={section.title}
                    className="animate-in fade-in-0"
                    style={{ animationDelay: `${sectionIndex * 34}ms` }}
                  >
                    <p
                      className={cn(
                        "mb-1.5 overflow-hidden px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-all duration-200",
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
                              ? "border-primary/45 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-[var(--shadow-soft)]"
                              : "border-transparent text-foreground/90 hover:-translate-y-0.5 hover:border-border/80 hover:bg-background/70 dark:hover:bg-background/55",
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
                              currentTab === item.id ? "text-primary-foreground" : item.iconClass,
                            )}
                          />
                          <span
                            className={cn(
                              "origin-left overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200",
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
            <div key={currentTab} className="animate-in fade-in-0 slide-in-from-bottom-2">
              {currentTab === "dashboard" ? <DashboardTab /> : null}
              {currentTab === "funcionarios" ? <FuncionariosTab /> : null}
              {currentTab === "unidades" ? <UnidadesTab /> : null}
              {currentTab === "setores" ? <SetoresTab /> : null}
              {currentTab === "funcoes" ? <FuncoesTab /> : null}
              {currentTab === "itens" ? <ItensTab /> : null}
              {isSuperadmin && currentTab === "credenciais" ? <CredenciaisTab /> : null}
              {isSuperadmin && currentTab === "auditoria" ? <AuditoriaTab /> : null}
              {isSuperadmin && currentTab === "configuracoes" ? <ConfiguracoesTab /> : null}
              {isSuperadmin && currentTab === "manutencao" ? <ManutencaoTab /> : null}
            </div>
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
