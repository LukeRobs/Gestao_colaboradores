// src/pages/DailyWorks/dwList.jsx
import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";

import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import api from "../../services/api";
import { useTurnosOperacionais } from "../../hooks/useTurnosOperacionais";

/* ==============================
   EMPRESAS FIXAS (OFICIAIS DW)
============================== */
const EMPRESAS_FIXAS = [
  { id: 12, nome: "SRM" },
  { id: 13, nome: "Fenix" },
  { id: 14, nome: "Horeca" },
  { id: 28, nome: "Diarias TECH" },
];

const OPCOES_POR_PAGINA = [10, 24, 50];

export default function DwListPage() {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState("TODOS");
  const [empresa, setEmpresa] = useState("TODAS");

  // Paginação
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { turnos: turnosDisponiveis } = useTurnosOperacionais();

  // Reinicia para página 1 sempre que os filtros ou itens por página mudarem
  useEffect(() => { setPagina(1); }, [data, turno, empresa, porPagina]);

  /* ================= PAGINAÇÃO ================= */
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const listaExibida = lista.slice(
    (paginaSegura - 1) * porPagina,
    paginaSegura * porPagina
  );

  /* ================= EXPORT CSV ================= */
  function exportarCSV() {
    if (lista.length === 0) return;

    const cabecalho = [
      "Data",
      ...EMPRESAS_FIXAS.map((e) => e.nome),
      "Total Planejado",
      "Total Real",
      "% Aderência",
      "Turno",
    ];

    const linhas = lista.map((row) => {
      const planejado = row.planejado || 0;
      const real = row.totalReal || 0;
      const aderencia =
        planejado > 0 ? ((real / planejado) * 100).toFixed(1) + "%" : "-";

      return [
        row.data,
        ...EMPRESAS_FIXAS.map((emp) => row.empresas?.[emp.nome] ?? 0),
        planejado,
        real,
        aderencia,
        row.turno,
      ];
    });

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

    // BOM UTF-8 para o Excel abrir corretamente
    const blob = new Blob(["﻿" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const sufixoData = data ? `_${data}` : "";
    const sufixoTurno = turno !== "TODOS" ? `_${turno}` : "";
    link.download = `daily_works${sufixoData}${sufixoTurno}.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleEditar(row) {
    navigate("/dw/novo", {
      state: {
        data: row.data,
        turno: row.idTurno,
      },
    });
  }

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        data: data || undefined,
        idTurno: turno !== "TODOS" ? turno : undefined,
        idEmpresa: empresa !== "TODAS" ? empresa : undefined,
      };

      const res = await api.get("/dw/lista", { params });
      setLista(res.data.data || []);
    } catch (error) {
      console.error("Erro ao carregar DW:", error);
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [data, turno, empresa]);

  useEffect(() => {
    load();
  }, [data, turno, empresa]);

  /* ================= HELPERS PAGINAÇÃO ================= */
  function gerarPaginas() {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    const paginas = [];
    paginas.push(1);
    if (paginaSegura > 3) paginas.push("...");
    for (
      let i = Math.max(2, paginaSegura - 1);
      i <= Math.min(totalPaginas - 1, paginaSegura + 1);
      i++
    ) {
      paginas.push(i);
    }
    if (paginaSegura < totalPaginas - 2) paginas.push("...");
    paginas.push(totalPaginas);
    return paginas;
  }

  return (
    <div className="flex min-h-screen bg-page text-page">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <MainLayout>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="px-8 py-6 space-y-6 max-w-7xl mx-auto">
          {/* HEADER */}
          <div>
            <h1 className="text-2xl font-semibold">Daily Works</h1>
            <p className="text-sm text-muted">
              Controle de diaristas planejados x realizados
            </p>
          </div>

          {/* FILTROS + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* DATA */}
              <div className="bg-surface px-4 py-2 rounded-xl">
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="bg-transparent outline-none text-sm text-white cursor-pointer"
                />
              </div>

              {/* TURNO */}
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="bg-surface text-sm px-4 py-2 rounded-xl text-muted outline-none hover:bg-surface-2 cursor-pointer"
              >
                <option value="TODOS">Turnos</option>
                {turnosDisponiveis.map((t) => (
                  <option key={t.idTurno} value={t.idTurno}>
                    {t.nomeTurno}
                  </option>
                ))}
              </select>

              {/* EMPRESA */}
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="bg-surface text-sm px-4 py-2 rounded-xl text-muted outline-none hover:bg-surface-2 cursor-pointer"
              >
                <option value="TODAS">Empresas</option>
                {EMPRESAS_FIXAS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>

              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-2 text-sm rounded-xl cursor-pointer transition"
              >
                <Search size={16} />
                Filtrar
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* EXPORTAR CSV */}
              <button
                onClick={exportarCSV}
                disabled={lista.length === 0}
                title="Exportar todos os dados filtrados para CSV"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm font-medium rounded-xl border border-default transition"
              >
                <Download size={16} />
                Exportar CSV
              </button>

              {/* NOVO DW */}
              <button
                onClick={() => navigate("/dw/novo")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FA4C00] hover:bg-[#ff5a1a] text-sm font-medium rounded-xl cursor-pointer transition"
              >
                <Plus size={16} />
                Novo DW
              </button>
            </div>
          </div>

          {/* LISTA */}
          <div className="bg-surface rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6 text-muted">Carregando dados…</div>
            ) : lista.length === 0 ? (
              <div className="p-6 text-center text-muted">
                Nenhum registro encontrado.
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="border-b border-default text-muted">
                    <tr>
                      <th className="px-6 py-4 text-left">Data</th>

                      {EMPRESAS_FIXAS.map((e) => (
                        <th key={e.id} className="px-6 py-4 text-center">
                          {e.nome}
                        </th>
                      ))}

                      <th className="px-6 py-4 text-center">Total Planejado</th>
                      <th className="px-6 py-4 text-center">Total Real</th>
                      <th className="px-6 py-4 text-center">% Aderência</th>
                      <th className="px-6 py-4 text-center">Turno</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {listaExibida.map((row, idx) => {
                      const planejado = row.planejado || 0;
                      const real = row.totalReal || 0;
                      const aderencia =
                        planejado > 0 ? (real / planejado) * 100 : null;

                      return (
                        <tr
                          key={idx}
                          className="border-t border-default hover:bg-surface-3"
                        >
                          <td className="px-6 py-4">{row.data}</td>

                          {EMPRESAS_FIXAS.map((emp) => (
                            <td
                              key={emp.id}
                              className="px-6 py-4 text-center font-semibold"
                            >
                              {row.empresas?.[emp.nome] || 0}
                            </td>
                          ))}

                          <td className="px-6 py-4 text-center font-semibold">
                            {planejado}
                          </td>

                          <td
                            className={`px-6 py-4 text-center font-semibold ${
                              real >= planejado
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {real}
                          </td>

                          <td
                            className={`px-6 py-4 text-center font-semibold ${
                              aderencia === null
                                ? "text-[#6B7280]"
                                : aderencia >= 95
                                ? "text-green-400"
                                : aderencia >= 85
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {aderencia === null
                              ? "-"
                              : `${aderencia.toFixed(1)}%`}
                          </td>

                          <td className="px-6 py-4 text-center font-semibold">
                            {row.turno}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleEditar(row)}
                              className="p-2 rounded-lg hover:bg-surface-2 cursor-pointer transition"
                            >
                              <Pencil size={16} className="text-[#FA4C00]" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ===== RODAPÉ DE PAGINAÇÃO ===== */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-default">
                  {/* Info + itens por página */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted">
                      {lista.length === 0
                        ? "0 registros"
                        : `${(paginaSegura - 1) * porPagina + 1}–${Math.min(
                            paginaSegura * porPagina,
                            lista.length
                          )} de ${lista.length} registros`}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">Exibir:</span>
                      {OPCOES_POR_PAGINA.map((op) => (
                        <button
                          key={op}
                          onClick={() => setPorPagina(op)}
                          className={`px-3 py-1 text-sm rounded-lg cursor-pointer transition ${
                            porPagina === op
                              ? "bg-[#FA4C00] text-white font-semibold"
                              : "bg-surface-2 text-muted hover:bg-surface-3"
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Navegação de páginas */}
                  {totalPaginas > 1 && (
                    <div className="flex items-center gap-1">
                      {/* Anterior */}
                      <button
                        onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        disabled={paginaSegura === 1}
                        className="p-2 rounded-lg hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {gerarPaginas().map((item, i) =>
                        item === "..." ? (
                          <span
                            key={`ellipsis-${i}`}
                            className="px-2 text-muted select-none"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setPagina(item)}
                            className={`w-9 h-9 text-sm rounded-lg cursor-pointer transition ${
                              item === paginaSegura
                                ? "bg-[#FA4C00] text-white font-semibold"
                                : "hover:bg-surface-2 text-muted"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}

                      {/* Próxima */}
                      <button
                        onClick={() =>
                          setPagina((p) => Math.min(totalPaginas, p + 1))
                        }
                        disabled={paginaSegura === totalPaginas}
                        className="p-2 rounded-lg hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </MainLayout>
    </div>
  );
}
