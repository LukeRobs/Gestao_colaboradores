import CHANGELOG from "../config/changelog";

export default function WhatsNewModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1A1A1C] border border-[#2A2A2C] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#2A2A2C]">
          <div>
            <h2 className="text-white font-semibold text-lg">🚀 {CHANGELOG.titulo}</h2>
            <p className="text-[#BFBFC3] text-xs mt-0.5">Versão {CHANGELOG.version}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#BFBFC3] hover:text-white transition text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Boas-vindas */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-sm text-[#BFBFC3] leading-relaxed">
            Olá! Seja bem-vindo à versão <span className="text-white font-medium">{CHANGELOG.version}</span>. A partir de agora, todas as novidades e melhorias do sistema serão comunicadas por aqui.
          </p>
        </div>

        {/* Items */}
        <ul className="px-6 py-4 space-y-3">
          {CHANGELOG.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[#EDEDED]">
              <span className="mt-0.5 text-[#FA4C00] shrink-0">✦</span>
              <span>
                {typeof item === "string" ? item : (
                  <>
                    <span className="font-semibold text-white">{item.titulo}</span>
                    {item.descricao && <span className="text-[#BFBFC3]"> — {item.descricao}</span>}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="
              relative w-full py-2.5 rounded-xl
              text-sm font-semibold text-white
              bg-[#FA4C00]
              cursor-pointer
              transition-all duration-300
              shadow-[0_0_6px_1px_rgba(250,76,0,0.35)]
              hover:shadow-[0_0_12px_3px_rgba(250,76,0,0.5)]
              hover:bg-[#ff5a10]
              active:scale-95
            "
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
