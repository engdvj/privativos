import { useState, type ReactNode } from "react";
import { Clock3, Mail, Phone } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface FooterProps {
  leading?: ReactNode;
}

const SUPPORT_EMAIL = "chvcti@saude.ba.gov.br";
const SUPPORT_PHONE_DISPLAY = "(77) 3229-2420";
const SUPPORT_PHONE_LINK = "+557732292420";
const SUPPORT_HOURS = "Segunda a sexta, 9h as 18h";

export function Footer({ leading }: FooterProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="border-t border-border/60 bg-surface-2/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div className="justify-self-start">
              {leading ? <div className="flex items-center">{leading}</div> : <span className="block h-8 w-8" aria-hidden />}
            </div>

            <p
              className="truncate text-center text-xs text-muted-foreground"
              title={`Controle de Privativos (c) ${currentYear} Secretaria da Saude da Bahia. Todos os direitos reservados.`}
            >
              Controle de Privativos (c) {currentYear} Secretaria da Saude da Bahia.
            </p>

            <button
              type="button"
              className="justify-self-end rounded-full border border-border/70 bg-background/55 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/45 hover:text-foreground"
              onClick={() => setContactOpen(true)}
            >
              Contato
            </button>
          </div>
        </div>
      </footer>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Contato"
        description="Estamos aqui para ajudar. Escolha o canal de sua preferencia."
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-1 px-4 py-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Email</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-1 px-4 py-3">
            <Phone className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Telefone</p>
              <a
                href={`tel:${SUPPORT_PHONE_LINK}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {SUPPORT_PHONE_DISPLAY}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-1 px-4 py-3">
            <Clock3 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Horario de atendimento</p>
              <p className="text-muted-foreground">{SUPPORT_HOURS}</p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
