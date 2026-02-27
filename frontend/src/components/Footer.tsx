import { useState, type ReactNode } from "react";
import { Clock3, HeadphonesIcon, Mail, Phone } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface FooterProps {
  leading?: ReactNode;
}

const SUPPORT_EMAIL = "chvcti@saude.ba.gov.br";
const SUPPORT_PHONE_DISPLAY = "(77) 3229-2420";
const SUPPORT_PHONE_LINK = "+557732292420";
const SUPPORT_HOURS = "Segunda a sexta, 9h às 18h";

export function Footer({ leading }: FooterProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="border-t border-border/60 bg-surface-2/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex w-full items-center gap-3">
          {leading && <div className="flex shrink-0 items-center">{leading}</div>}

          <p className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground sm:text-xs">
            © {currentYear} Secretaria da Saúde da Bahia — Controle de Privativos
          </p>

          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:text-xs"
            onClick={() => setContactOpen(true)}
          >
            <HeadphonesIcon className="h-3.5 w-3.5" />
            Suporte
          </button>
        </div>
      </footer>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Suporte"
        description="Estamos aqui para ajudar. Escolha o canal de sua preferência."
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Email</p>
              <p className="truncate text-xs text-muted-foreground">{SUPPORT_EMAIL}</p>
            </div>
          </a>

          <a
            href={`tel:${SUPPORT_PHONE_LINK}`}
            className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-1 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Phone className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Telefone</p>
              <p className="text-xs text-muted-foreground">{SUPPORT_PHONE_DISPLAY}</p>
            </div>
          </a>

          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-1 px-4 py-3">
            <Clock3 className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Horário de atendimento</p>
              <p className="text-xs text-muted-foreground">{SUPPORT_HOURS}</p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
