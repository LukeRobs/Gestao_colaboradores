import { useRef, useState } from "react";
import { X, Download, Upload, Loader2, CheckCircle2, AlertTriangle, FileUp, FileSpreadsheet } from "lucide-react";
import { SolicitacoesOperacionaisAPI } from "../../services/solicitacoesOperacionais";

function baixarModeloCsv() {
  const cabecalho = ["CPF", "Data", "Motivo"];
  const linhas = [
    ["000.000.000-00", "15/09/2026", "Exemplo de motivo da folga"],
  ];

  const csvContent = [cabecalho, ...linhas]
    .map((cols) =>
      cols
        .map((v) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = "modelo_folga.csv";
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportarFolgaModal({ onClose }) {
  const fileInputRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [arrastando, setArrastando] = useState(false);

  const validarEDefinir = (f) => {
    setErro(null);
    setResultado(null);
    if (f && !f.name.toLowerCase().endsWith(".csv")) {
      setErro("Selecione um arquivo .csv");
      setArquivo(null);
      return;
    }
    setArquivo(f || null);
  };

  const escolherArquivo = (e) => {
    validarEDefinir(e.target.files?.[0]);
  };

  const limparArquivo = () => {
    setArquivo(null);
    setErro(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setArrastando(false);
    validarEDefinir(e.dataTransfer.files?.[0]);
  };

  const enviar = async () => {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const data = await SolicitacoesOperacionaisAPI.importarFolgaLote(arquivo);
      setResultado(data);
      setArquivo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setErro(e.response?.data?.message || "Erro ao importar o arquivo");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl w-full max-w-lg border border-default shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-default shrink-0">
          <div>
            <h2 className="font-semibold text-base">Importar Folga em Massa</h2>
            <p className="text-xs text-muted mt-0.5">Crie várias solicitações de uma vez a partir de um CSV</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-page transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <p className="text-xs text-muted">
              1. Baixe o modelo, preencha uma linha por colaborador e envie de volta.
            </p>
            <button
              onClick={baixarModeloCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm transition-colors cursor-pointer"
            >
              <Download size={14} /> Baixar modelo CSV
            </button>
            <p className="text-[11px] text-muted">
              Colunas: <span className="text-page">CPF, Data (dd/mm/aaaa), Motivo</span>.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-default">
            <p className="text-xs text-muted">2. Envie o arquivo preenchido</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={escolherArquivo}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={handleDrop}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                arrastando ? "border-[#FA4C00] bg-[#FA4C00]/5" : "border-default hover:border-[#FA4C00]/50 hover:bg-surface-2/50"
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${arquivo ? "bg-[#34C759]/10" : "bg-[#FA4C00]/10"}`}>
                {arquivo ? (
                  <FileSpreadsheet size={20} className="text-[#34C759]" />
                ) : (
                  <FileUp size={20} className="text-[#FA4C00]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {arquivo ? (
                  <>
                    <p className="text-sm text-page truncate">{arquivo.name}</p>
                    <p className="text-[11px] text-muted">{(arquivo.size / 1024).toFixed(1)} KB — clique para trocar</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-page font-medium">Escolher arquivo CSV</p>
                    <p className="text-[11px] text-muted">ou arraste e solte aqui</p>
                  </>
                )}
              </div>
              {arquivo && (
                <button
                  onClick={(e) => { e.stopPropagation(); limparArquivo(); }}
                  className="p-1.5 rounded-lg text-muted hover:text-page hover:bg-surface-3 transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={enviar}
              disabled={!arquivo || enviando}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                !arquivo || enviando ? "bg-[#FA4C00]/40 text-white/60 cursor-not-allowed" : "bg-[#FA4C00] hover:bg-[#D84300] text-white"
              }`}
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {enviando ? "Importando..." : "Enviar arquivo"}
            </button>
          </div>

          {erro && (
            <div className="flex gap-2.5 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/5 p-3">
              <AlertTriangle size={15} className="text-[#FF453A] shrink-0 mt-0.5" />
              <p className="text-xs text-[#FF453A]">{erro}</p>
            </div>
          )}

          {resultado && (
            <div className="space-y-3 pt-2 border-t border-default">
              <div className="flex gap-2.5 rounded-xl border border-[#34C759]/30 bg-[#34C759]/5 p-3">
                <CheckCircle2 size={15} className="text-[#34C759] shrink-0 mt-0.5" />
                <p className="text-xs text-[#34C759]">
                  {resultado.criadas} de {resultado.totalLinhas} linha(s) criada(s) com sucesso.
                </p>
              </div>

              {resultado.erros?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted">{resultado.erros.length} linha(s) com erro:</p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-default divide-y divide-default">
                    {resultado.erros.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <span className="text-muted">Linha {e.linha}{e.cpf ? ` (CPF ${e.cpf})` : ""}:</span>{" "}
                        <span className="text-[#FF453A]">{e.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
