import { useState, type ReactNode } from "react";
import { Clock3, HeadphonesIcon, Mail, Phone } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface FooterProps {
  leading?: ReactNode;
}

const SUPPORT_EMAIL = "chvcti@saude.ba.gov.br";
const SUPPORT_PHONE_DISPLAY = "(77) 3229-2420";
const SUPPORT_PHONE_LINK = "+557732292420";
const SUPPORT_HOURS = "Segunda a sexta, 7h as 18h";

export function Footer({ leading }: FooterProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="border-t border-border/70 bg-gradient-to-r from-surface-2/92 via-background/86 to-surface-2/92 backdrop-blur-xl dark:border-border/85 dark:from-card/88 dark:via-background/80 dark:to-card/88">
        <div className="mx-auto flex h-11 w-full items-center gap-2.5 px-3 sm:h-12 sm:px-6">
          {leading && <div className="flex shrink-0 items-center">{leading}</div>}

          <p className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]">
            Privativos | (c) {currentYear}
          </p>

          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-background/70 px-2 text-[10px] font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent/40 hover:text-foreground dark:border-border/85 dark:bg-background/62 sm:h-8 sm:px-2.5 sm:text-[11px]"
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
        description="Estamos aqui para ajudar. Escolha o canal de sua preferencia."
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-2.5">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface-1 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 animate-in fade-in-0 slide-in-from-bottom-2 dark:border-border/85 dark:bg-background/65"
          >
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Email</p>
              <p className="truncate text-xs text-muted-foreground">{SUPPORT_EMAIL}</p>
            </div>
          </a>

          <a
            href={`tel:${SUPPORT_PHONE_LINK}`}
            className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface-1 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 animate-in fade-in-0 slide-in-from-bottom-2 dark:border-border/85 dark:bg-background/65"
            style={{ animationDelay: "50ms" }}
          >
            <Phone className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Telefone</p>
              <p className="text-xs text-muted-foreground">{SUPPORT_PHONE_DISPLAY}</p>
            </div>
          </a>

          <div
            className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface-1 px-3 py-2.5 animate-in fade-in-0 slide-in-from-bottom-2 dark:border-border/85 dark:bg-background/65"
            style={{ animationDelay: "100ms" }}
          >
            <Clock3 className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Horario de atendimento</p>
              <p className="text-xs text-muted-foreground">{SUPPORT_HOURS}</p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
