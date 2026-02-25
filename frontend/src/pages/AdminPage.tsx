import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
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
import { DashboardTab } from "./admin/tabs/DashboardTab";
import { FuncionariosTab } from "./admin/tabs/FuncionariosTab";
import { SetoresTab } from "./admin/tabs/SetoresTab";
import { FuncoesTab } from "./admin/tabs/FuncoesTab";
import { ItensTab } from "./admin/tabs/ItensTab";
import { CredenciaisTab } from "./admin/tabs/CredenciaisTab";
import { AuditoriaTab } from "./admin/tabs/AuditoriaTab";
import { ConfiguracoesTab } from "./admin/tabs/ConfiguracoesTab";

const SIDEBAR_MIN_WIDTH = 232;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 88;
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
            iconClass: "text-sky-600",
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
            iconClass: "text-indigo-600",
          },
          {
            id: "setores",
            label: "Setores",
            icon: Building2,
            iconClass: "text-emerald-600",
          },
          {
            id: "funcoes",
            label: "Funcoes",
            icon: UserCog,
            iconClass: "text-cyan-700",
          },
          {
            id: "itens",
            label: "Itens",
            icon: Boxes,
            iconClass: "text-amber-600",
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
                  iconClass: "text-cyan-600",
                },
                {
                  id: "auditoria",
                  label: "Auditoria",
                  icon: ClipboardList,
                  iconClass: "text-rose-600",
                },
                {
                  id: "configuracoes",
                  label: "Configuracoes",
                  icon: Settings,
                  iconClass: "text-slate-600",
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
        <div className="grid h-full min-h-0 md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]" style={layoutStyle}>
          <div className="relative h-full min-h-0">
            <aside className="flex h-full min-h-0 flex-col border-r border-border/65 bg-surface-2/70 backdrop-blur">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pt-4">
                {menuSections.map((section) => (
                  <div key={section.title}>
                    {!isIconOnly ? (
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {section.title}
                      </p>
                    ) : null}

                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Button
                          key={item.id}
                          variant={currentTab === item.id ? "default" : "ghost"}
                          className={isIconOnly ? "w-full justify-center px-2" : "w-full justify-start"}
                          onClick={() => setActiveTab(item.id)}
                          title={item.label}
                        >
                          <item.icon
                            className={`h-4 w-4 ${
                              currentTab === item.id ? "text-primary-foreground" : item.iconClass
                            }`}
                          />
                          {!isIconOnly ? <span>{item.label}</span> : null}
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
              className="absolute top-0 right-0 hidden h-full w-2 cursor-col-resize bg-transparent transition-colors hover:bg-primary/20 md:block"
              onMouseDown={startSidebarResize}
            />
          </div>

          <section className="min-h-0 min-w-0 overflow-y-auto p-4 md:p-6">
            {currentTab === "dashboard" ? <DashboardTab /> : null}
            {currentTab === "funcionarios" ? <FuncionariosTab /> : null}
            {currentTab === "setores" ? <SetoresTab /> : null}
            {currentTab === "funcoes" ? <FuncoesTab /> : null}
            {currentTab === "itens" ? <ItensTab /> : null}
            {isSuperadmin && currentTab === "credenciais" ? <CredenciaisTab /> : null}
            {isSuperadmin && currentTab === "auditoria" ? <AuditoriaTab /> : null}
            {isSuperadmin && currentTab === "configuracoes" ? <ConfiguracoesTab /> : null}
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
            className="h-8 w-8 rounded-lg"
          >
            {isIconOnly ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </Button>
        )}
      />
    </div>
  );
}
