import { useEffect, useState } from "react";
import { Clock3, Mail, Moon, Phone, Sun } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export function Footer() {
  const [contactOpen, setContactOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const shouldUseDark = savedTheme === "dark";
    document.documentElement.classList.toggle("dark", shouldUseDark);
    setDarkMode(shouldUseDark);
  }, []);

  function toggleTheme() {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    document.documentElement.classList.toggle("dark", nextDarkMode);
    localStorage.setItem("theme", nextDarkMode ? "dark" : "light");
  }

  return (
    <>
      <footer className="border-t border-slate-200/80 bg-white/85 px-4 py-4 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start justify-between gap-3 text-xs tracking-[0.18em] text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="font-semibold uppercase text-slate-800 dark:text-slate-100">Controle de Privativos</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              type="button"
              className="uppercase transition-colors hover:text-slate-900 dark:hover:text-white"
              onClick={() => setContactOpen(true)}
            >
              Contato
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:text-white"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {darkMode ? "Modo Claro" : "Modo Escuro"}
            </button>
          </div>
          <p className="uppercase">(c) 2026 todos os direitos reservados.</p>
        </div>
      </footer>

      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="CONTATO">
        <div className="space-y-4">
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Estamos aqui para ajudar. Escolha o canal de sua preferencia.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <Mail className="mt-0.5 h-5 w-5 text-slate-700 dark:text-slate-200" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-slate-600 dark:text-slate-300">chvcti@saude.ba.gov.br</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <Phone className="mt-0.5 h-5 w-5 text-slate-700 dark:text-slate-200" />
              <div>
                <p className="font-medium">Telefone</p>
                <p className="text-slate-600 dark:text-slate-300">(77) 3229-2420</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <Clock3 className="mt-0.5 h-5 w-5 text-slate-700 dark:text-slate-200" />
              <div>
                <p className="font-medium">Horario de Atendimento</p>
                <p className="text-slate-600 dark:text-slate-300">Segunda a Sexta, 9h as 18h</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
