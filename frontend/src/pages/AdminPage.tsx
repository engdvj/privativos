import { useEffect, useState, type CSSProperties } from "react";
import {
  Boxes,
  BarChart3,
  Building2,
  ClipboardList,
  IdCard,
  KeyRound,
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

export function AdminPage() {
  const perfil = api.getPerfil();
  const isSuperadmin = perfil === "superadmin";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isIconOnly = sidebarCollapsed;
  const sidebarWidth = sidebarCollapsed ? 84 : 250;

  const menuSections = [
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
          iconClass: "text-violet-600",
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
  ] as const;

  const tabIds = menuSections.flatMap((section) => section.items.map((item) => item.id));

  useEffect(() => {
    if (!tabIds.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, tabIds]);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  const layoutStyle = {
    ["--sidebar-width" as string]: `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Header onLogoClick={toggleSidebar} />
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]" style={layoutStyle}>
          <aside className="h-full min-h-0 overflow-y-auto border-r border-border/80 bg-white/65 backdrop-blur-sm dark:bg-slate-900">
            <div className="space-y-4 p-4 pt-6">
              {menuSections.map((section) => (
                <div key={section.title}>
                  {!isIconOnly && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </p>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Button
                        key={item.id}
                        variant={activeTab === item.id ? "default" : "ghost"}
                        className={isIconOnly ? "w-full justify-center px-2" : "w-full justify-start"}
                        onClick={() => setActiveTab(item.id)}
                        title={item.label}
                      >
                        <item.icon
                          className={`h-4 w-4 ${
                            activeTab === item.id ? "text-primary-foreground" : item.iconClass
                          }`}
                        />
                        {!isIconOnly && <span>{item.label}</span>}
                      </Button>
                    ))}
                  </div>
                </div>
                ))}
            </div>
          </aside>

          <section className="min-h-0 min-w-0 overflow-y-auto p-4 md:p-6">
            {activeTab === "dashboard" && <DashboardTab />}
            {activeTab === "funcionarios" && <FuncionariosTab />}
            {activeTab === "setores" && <SetoresTab />}
            {activeTab === "funcoes" && <FuncoesTab />}
            {activeTab === "itens" && <ItensTab />}
            {isSuperadmin && activeTab === "credenciais" && <CredenciaisTab />}
            {isSuperadmin && activeTab === "auditoria" && <AuditoriaTab />}
            {isSuperadmin && activeTab === "configuracoes" && <ConfiguracoesTab />}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
