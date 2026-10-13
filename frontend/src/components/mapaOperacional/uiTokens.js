// Constantes e utilitários do kit visual do Label (separados de ui.jsx pra manter
// aquele arquivo só com componentes, como o fast refresh exige).

export const FOCO = "outline-none focus-visible:ring-2 focus-visible:ring-[#FA4C00]/70";

export const BTN_SECUNDARIO = `h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-surface hover:bg-surface-2 border border-default text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${FOCO}`;
export const BTN_PRIMARIO = `h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FA4C00] hover:bg-[#D84300] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${FOCO}`;
export const BTN_PERIGO = `h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF453A]/10 hover:bg-[#FF453A]/15 text-[#FF453A] text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${FOCO}`;
export const INPUT = `w-full h-11 px-3 bg-surface-2 border border-default rounded-xl text-sm text-page placeholder-muted ${FOCO}`;

const pad2 = (n) => String(n).padStart(2, "0");

export function somarDias(iso, dias) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export const formatNumero = (n) => (n === undefined || n === null ? "—" : new Intl.NumberFormat("pt-BR").format(n));

// Funções por operação na Gestão de Docas (LOG II e Volante existem nas duas, igual às esteiras).
export const FUNCOES_DOCA = {
  INBOUND: [
    { value: "RECEIVED", label: "Received" },
    { value: "PULL", label: "Pull" },
    { value: "LOG_II", label: "LOG II" },
    { value: "VOLANTE", label: "Volante" },
  ],
  OUTBOUND: [
    { value: "CONFERENTE", label: "Conferente" },
    { value: "PUSH", label: "Push" },
    { value: "LOG_II", label: "LOG II" },
    { value: "VOLANTE", label: "Volante" },
  ],
};

// Funções manuais de esteira (sem braço): mesmas opções em toda esteira.
export const LABORS_MANUAIS = [
  { value: "PESCA", label: "Pesca" },
  { value: "GOL", label: "Gol" },
  { value: "ENDERECAMENTO", label: "Endereçamento" },
  { value: "INDUCAO", label: "Indução" },
  { value: "ABASTECEDOR", label: "Abastecedor" },
  { value: "MONTAGEM_SCUTTLE", label: "5S / Montagem Scuttle" },
  { value: "VOLANTE", label: "Volante" },
  { value: "LOG_II", label: "LOG II" },
];

// Turno que ainda não começou (aceita pré-alocação). `atual` é a resposta de obterTurnoAtual.
const ORDEM_TURNO = { T1: 1, T2: 2, T3: 3 };
export function ehTurnoFuturo(atual, data, turno) {
  if (!atual || !data || !turno) return false;
  if (data !== atual.diaOperacionalStr) return data > atual.diaOperacionalStr;
  return ORDEM_TURNO[turno] > ORDEM_TURNO[atual.turno];
}

// Posição de uma pesca na esteira: sem braço ou "Braço 3A".
export const rotuloPosicao = (braco, lado) => (braco == null ? "Sem braço" : `Braço ${braco}${lado}`);

// Cor da Pesca no mapa e nos cartões (azul: distinto de manual/diarista/automático).
export const COR_PESCA = "#2563EB";
