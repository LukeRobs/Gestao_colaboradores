import { Ban, CircleCheck, Clock, PackageOpen, Truck, UserX } from "lucide-react";
import { Pilula } from "./FilaPecas";
import { CLASSES_ETA, SITUACOES } from "./inboundUtils";

// Peças visuais do Planning Inbound.

const ICONES = {
  RECEBIDA: CircleCheck,
  NO_PATIO: PackageOpen,
  EM_TRANSITO: Truck,
  PROGRAMADA: Clock,
  CANCELADA: Ban,
  NO_SHOW: UserX,
  SEM_PROGRAMACAO: Clock,
};

export function PilulaSituacao({ situacao }) {
  const s = SITUACOES[situacao] || SITUACOES.PROGRAMADA;
  const Icone = ICONES[situacao] || Clock;
  return <Pilula cor={s.cor} icone={<Icone size={12} aria-hidden="true" />}>{s.rotulo}</Pilula>;
}

export function PilulaEta({ classe }) {
  if (!classe) return <span className="text-muted">—</span>;
  const c = CLASSES_ETA[classe];
  return <Pilula cor={c.cor} icone={<span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: c.cor }} />}>{c.rotulo}</Pilula>;
}
