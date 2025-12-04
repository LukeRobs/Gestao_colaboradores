// src/pages/empresas.jsx
import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import EmpresaModal from "../components/EmpresaModal";
import EmpresaTable from "../components/EmpresaTable";
import { EmpresasAPI } from "../services/empresas";

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await EmpresasAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setEmpresas(list);
    } catch (err) {
      console.error("Erro ao listar empresas:", err);
      alert("Erro ao carregar empresas.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleEdit = (empresa) => {
    setSelected(empresa);
    setModalOpen(true);
  };

  const handleDelete = async (empresa) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a empresa "${empresa.razaoSocial}" (ID ${empresa.idEmpresa})?`
      )
    )
      return;

    try {
      await EmpresasAPI.excluir(empresa.idEmpresa);
      load();
    } catch (err) {
      console.error("Erro ao excluir empresa:", err);
      alert("Erro ao excluir empresa.");
    }
  };

  const filtered = empresas.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      e.razaoSocial?.toLowerCase().includes(q) ||
      e.cnpj?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 relative">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}
      />

      <div className="flex-1 lg:ml-64 transition-all duration-300">
        {/* HEADER */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* CONTEÚDO */}
        <div className="p-6">
          {/* TÍTULO + AÇÕES */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Empresas
            </h1>

            <div className="flex items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por razão social ou CNPJ..."
                className="px-4 py-2 rounded-xl border bg-white dark:bg-gray-800 dark:text-white"
              />

              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow"
              >
                <Plus className="w-4 h-4" />
                Nova Empresa
              </button>
            </div>
          </div>

          {/* TABELA */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
            {loading ? (
              <p className="p-6 text-gray-500">Carregando empresas...</p>
            ) : (
              <EmpresaTable
                empresas={filtered}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <EmpresaModal
          key={selected?.idEmpresa || "new"}
          empresa={selected}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={async (data) => {
            try {
              if (selected?.idEmpresa) {
                await EmpresasAPI.atualizar(selected.idEmpresa, data);
              } else {
                await EmpresasAPI.criar(data);
              }
              setModalOpen(false);
              setSelected(null);
              load();
            } catch (err) {
              console.error("Erro ao salvar empresa:", err);
              const msg =
                err?.response?.data?.message || "Erro ao salvar empresa.";
              alert(msg);
            }
          }}
        />
      )}
    </div>
  );
}
