import { useState, useEffect } from "react";
import api from "../services/api";

export default function EmployeeModal({ employee, onClose, onSave }) {
  const formatHorario = (value) => {
    if (!value) return "";
    try {
      const date = new Date(value);
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch {
      return "";
    }
  };

  const [form, setForm] = useState({
    opsId: employee?.opsId || "",
    nomeCompleto: employee?.nomeCompleto || "",
    cpf: employee?.cpf || "",
    telefone: employee?.telefone || "",
    email: employee?.email || "",
    genero: employee?.genero || "",
    matricula: employee?.matricula || "",
    dataAdmissao: employee?.dataAdmissao?.split("T")[0] || "",
    horarioInicioJornada: formatHorario(employee?.horarioInicioJornada),
    empresaNome: employee?.empresa?.razaoSocial || "",
    cargoNome: employee?.cargo?.nomeCargo || "",
    idSetor: employee?.setor?.idSetor || "",
    idLider: employee?.lider?.opsId || "",
    idEstacao: employee?.estacao?.idEstacao || "",
    idContrato: employee?.contrato?.idContrato || "",
    idEscala: employee?.escala?.idEscala || "",
    idTurno: employee?.turno?.idTurno || "",
    status: employee?.status || "ATIVO",
  });

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const [empresas, setEmpresas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [lideres, setLideres] = useState([]);
  const [estacoes, setEstacoes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [turnos, setTurnos] = useState([]);

  useEffect(() => {
    async function loadLists() {
      const [emp, cg, st, lid, est, ct, esc, tr] = await Promise.all([
        api.get("/empresas"),
        api.get("/cargos"),
        api.get("/setores"),
        api.get("/colaboradores"), // líderes
        api.get("/estacoes"),
        api.get("/contratos"),
        api.get("/escalas"),
        api.get("/turnos"),
      ]);

      setEmpresas(emp.data.data);
      setCargos(cg.data.data);
      setSetores(st.data.data);
      setLideres(lid.data.data);
      setEstacoes(est.data.data);
      setContratos(ct.data.data);
      setEscalas(esc.data.data);
      setTurnos(tr.data.data);
    }

    loadLists();
  }, []);

  const HORARIOS = ["05:25", "13:20", "21:00"];

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full p-6 shadow-xl">
        <h2 className="text-2xl font-bold mb-4">
          {employee ? "Editar Colaborador" : "Novo Colaborador"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* CAMPOS DE TEXTO */}
          {[
            ["opsId", "OPS ID"],
            ["nomeCompleto", "Nome Completo"],
            ["cpf", "CPF"],
            ["telefone", "Telefone"],
            ["email", "E-mail"],
            ["genero", "Gênero"],
            ["matricula", "Matrícula"],
            ["dataAdmissao", "Data de Admissão", "date"],
          ].map(([field, label, type]) => (
            <div key={field}>
              <label className="block text-sm mb-1">{label}</label>
              <input
                type={type || "text"}
                value={form[field]}
                onChange={(e) => update(field, e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
              />
            </div>
          ))}

          {/* HORÁRIO (SELECT) */}
          <div>
            <label className="block text-sm mb-1">Hora Início Jornada</label>
            <select
              value={form.horarioInicioJornada}
              onChange={(e) => update("horarioInicioJornada", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {HORARIOS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* EMPRESA */}
          <div>
            <label className="block text-sm mb-1">Empresa</label>
            <select
              value={form.empresaNome}
              onChange={(e) => update("empresaNome", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.idEmpresa} value={e.razaoSocial}>
                  {e.razaoSocial}
                </option>
              ))}
            </select>
          </div>

          {/* CARGO */}
          <div>
            <label className="block text-sm mb-1">Cargo</label>
            <select
              value={form.cargoNome}
              onChange={(e) => update("cargoNome", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {cargos.map((c) => (
                <option key={c.idCargo} value={c.nomeCargo}>
                  {c.nomeCargo} ({c.nivel})
                </option>
              ))}
            </select>
          </div>

          {/* SETOR */}
          <div>
            <label className="block text-sm mb-1">Setor</label>
            <select
              value={form.idSetor}
              onChange={(e) => update("idSetor", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {setores.map((s) => (
                <option key={s.idSetor} value={s.idSetor}>
                  {s.nomeSetor}
                </option>
              ))}
            </select>
          </div>

          {/* LÍDER */}
          <div>
            <label className="block text-sm mb-1">Líder</label>
            <select
              value={form.idLider}
              onChange={(e) => update("idLider", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {lideres.map((l) => (
                <option key={l.opsId} value={l.opsId}>
                  {l.nomeCompleto}
                </option>
              ))}
            </select>
          </div>

          {/* ESTAÇÃO */}
          <div>
            <label className="block text-sm mb-1">Estação</label>
            <select
              value={form.idEstacao}
              onChange={(e) => update("idEstacao", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {estacoes.map((x) => (
                <option key={x.idEstacao} value={x.idEstacao}>
                  {x.nomeEstacao}
                </option>
              ))}
            </select>
          </div>

          {/* CONTRATO */}
          <div>
            <label className="block text-sm mb-1">Contrato</label>
            <select
              value={form.idContrato}
              onChange={(e) => update("idContrato", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {contratos.map((c) => (
                <option key={c.idContrato} value={c.idContrato}>
                  {c.nomeContrato}
                </option>
              ))}
            </select>
          </div>

          {/* ESCALA */}
          <div>
            <label className="block text-sm mb-1">Escala</label>
            <select
              value={form.idEscala}
              onChange={(e) => update("idEscala", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {escalas.map((e) => (
                <option key={e.idEscala} value={e.idEscala}>
                  {e.nomeEscala}
                </option>
              ))}
            </select>
          </div>

          {/* TURNO */}
          <div>
            <label className="block text-sm mb-1">Turno</label>
            <select
              value={form.idTurno}
              onChange={(e) => update("idTurno", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="">Selecione...</option>
              {turnos.map((t) => (
                <option key={t.idTurno} value={t.idTurno}>
                  {t.nomeTurno}
                </option>
              ))}
            </select>
          </div>

          {/* STATUS */}
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border"
            >
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-6 gap-3">
          <button onClick={onClose} className="px-6 py-3 bg-gray-200 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
