import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

import EmployeeModal from "../components/EmployeeModal";
import EmployeeTable from "../components/EmployeeTable";
import { ColaboradoresAPI } from "../services/colaboradores";

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate(); // 👈 ESSENCIAL

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ColaboradoresAPI.listar({
        limit: 1000,
        search: query || undefined,
      });
      setEmployees(list);
    } catch (err) {
      console.error("Erro ao listar colaboradores:", err);
      alert("Erro ao carregar colaboradores.");
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

  const handleEdit = (emp) => {
    setSelected(emp);
    setModalOpen(true);
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Excluir o colaborador "${emp.nomeCompleto}"?`)) return;
    try {
      await ColaboradoresAPI.excluir(emp.opsId);
      load();
    } catch (err) {
      console.error("Erro ao excluir colaborador:", err);
      alert("Erro ao excluir colaborador.");
    }
  };

  const filtered = employees.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      e.nomeCompleto?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.cpf?.toLowerCase().includes(q) ||
      String(e.opsId)?.includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 relative">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigate={navigate}   // 👈 ENVIE O navigate AQUI
      />

      <div className="flex-1 lg:ml-64 transition-all duration-300">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Colaboradores
            </h1>

            <div className="flex items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nome, e-mail, CPF ou OPS ID..."
                className="px-4 py-2 rounded-xl border bg-white dark:bg-gray-800 dark:text-white"
              />

              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow"
              >
                <Plus className="w-4 h-4" />
                Adicionar Colaborador
              </button>
            </div>
          </div>

          <div className="bg-red-600 dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
            {loading ? (
              <p className="p-6 text-gray-500">Carregando colaboradores...</p>
            ) : (
              <EmployeeTable
                employees={filtered}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <EmployeeModal
          key={selected?.opsId || "new"}
          employee={selected}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={async (data) => {
            try {
              if (selected) {
                await ColaboradoresAPI.atualizar(selected.opsId, data);
              } else {
                await ColaboradoresAPI.criar(data);
              }
              setModalOpen(false);
              setSelected(null);
              load();
            } catch (err) {
              console.error("Erro ao salvar colaborador:", err);
              alert("Erro ao salvar colaborador.");
            }
          }}
        />
      )}
    </div>
  );
}
