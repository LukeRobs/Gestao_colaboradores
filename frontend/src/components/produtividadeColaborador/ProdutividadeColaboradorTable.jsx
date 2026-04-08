import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Search, Trophy, Medal, Award } from "lucide-react";

export default function ProdutividadeColaboradorTable({ colaboradores, horasTurno, turno }) {
  const [ordenacao, setOrdenacao] = useState({ campo: 'total', direcao: 'desc' });
  const [filtro, setFiltro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const itensPorPagina = 50;

  // Detectar tamanho da tela
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!colaboradores || colaboradores.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        Nenhum colaborador encontrado para este turno
      </div>
    );
  }

  // Filtrar colaboradores
  const colaboradoresFiltrados = colaboradores.filter(colab =>
    colab.nomeCompleto.toLowerCase().includes(filtro.toLowerCase()) ||
    colab.opsId.toLowerCase().includes(filtro.toLowerCase()) ||
    colab.setor.toLowerCase().includes(filtro.toLowerCase()) ||
    colab.cargo.toLowerCase().includes(filtro.toLowerCase())
  );

  // Ordenar colaboradores
  const colaboradoresOrdenados = [...colaboradoresFiltrados].sort((a, b) => {
    let valorA = a[ordenacao.campo];
    let valorB = b[ordenacao.campo];

    // Para campos de texto
    if (typeof valorA === 'string') {
      valorA = valorA.toLowerCase();
      valorB = valorB.toLowerCase();
    }

    if (ordenacao.direcao === 'asc') {
      return valorA > valorB ? 1 : -1;
    } else {
      return valorA < valorB ? 1 : -1;
    }
  });

  // Paginação
  const totalPaginas = Math.ceil(colaboradoresOrdenados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const colaboradoresPaginados = colaboradoresOrdenados.slice(indiceInicio, indiceInicio + itensPorPagina);

  const alterarOrdenacao = (campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'desc' ? 'asc' : 'desc'
    }));
  };

  const obterIconeOrdenacao = (campo) => {
    if (ordenacao.campo !== campo) return null;
    return ordenacao.direcao === 'desc' ? 
      <ChevronDown className="w-4 h-4 inline ml-1" /> : 
      <ChevronUp className="w-4 h-4 inline ml-1" />;
  };

  const obterCorQuantidade = (quantidade) => {
    if (quantidade === 0) return "text-gray-400";
    if (quantidade >= 700) return "bg-green-200 text-green-900 font-semibold rounded px-1";
    if (quantidade < 500) return "bg-red-200 text-red-900 font-semibold rounded px-1";
    return "bg-yellow-100 text-yellow-900 font-semibold rounded px-1"; // entre 500 e 699
  };

  const obterIconeRanking = (posicao) => {
    if (posicao === 1) return <Trophy className="w-4 h-4 text-yellow-400 inline mr-1" />;
    if (posicao === 2) return <Medal className="w-4 h-4 text-gray-300 inline mr-1" />;
    if (posicao === 3) return <Award className="w-4 h-4 text-orange-400 inline mr-1" />;
    return null;
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Filtro de busca */}
      <div className="mb-6">
        <div className="relative max-w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar colaborador..."
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setPaginaAtual(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-[#3A3A3C] rounded-md text-white placeholder-[#BFBFC3] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="mt-2 text-xs sm:text-sm text-muted">
          Mostrando {colaboradoresFiltrados.length} de {colaboradores.length} colaboradores
        </div>
      </div>

      {/* Tabela Desktop */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2">
                <th className="border border-[#3A3A3C] p-2 text-left font-semibold text-white text-xs w-12">
                  #
                </th>
                <th 
                  className="border border-[#3A3A3C] p-2 text-left font-semibold text-white cursor-pointer hover:bg-[#3A3A3C] text-xs min-w-[180px]"
                  onClick={() => alterarOrdenacao('nomeCompleto')}
                >
                  Colaborador {obterIconeOrdenacao('nomeCompleto')}
                </th>
                <th 
                  className="border border-[#3A3A3C] p-2 text-left font-semibold text-white cursor-pointer hover:bg-[#3A3A3C] text-xs w-24"
                  onClick={() => alterarOrdenacao('opsId')}
                >
                  OPS ID {obterIconeOrdenacao('opsId')}
                </th>
                <th 
                  className="border border-[#3A3A3C] p-2 text-left font-semibold text-white cursor-pointer hover:bg-[#3A3A3C] text-xs w-28"
                  onClick={() => alterarOrdenacao('setor')}
                >
                  Setor {obterIconeOrdenacao('setor')}
                </th>
                
                {/* Colunas das horas */}
                {horasTurno.map(hora => (
                  <th 
                    key={hora}
                    className="border border-[#3A3A3C] p-1 text-center font-semibold text-white cursor-pointer hover:bg-[#3A3A3C] text-xs w-16"
                    onClick={() => alterarOrdenacao(hora)}
                  >
                    {hora.split(':')[0]}h {obterIconeOrdenacao(hora)}
                  </th>
                ))}
                
                <th 
                  className="border border-[#3A3A3C] p-2 text-center font-semibold text-white cursor-pointer hover:bg-[#3A3A3C] text-xs w-20 bg-[#1A4B3A]"
                  onClick={() => alterarOrdenacao('total')}
                >
                  Total {obterIconeOrdenacao('total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {colaboradoresPaginados.map((colaborador, index) => {
                const posicaoGeral = indiceInicio + index + 1;
                return (
                  <tr key={colaborador.opsId} className="hover:bg-surface-3">
                    <td className="border border-[#3A3A3C] p-2 text-center text-muted text-xs">
                      {obterIconeRanking(posicaoGeral)}
                      {posicaoGeral}
                    </td>
                    <td className="border border-[#3A3A3C] p-2 text-white font-medium text-xs">
                      <div className="truncate max-w-[180px]" title={colaborador.nomeCompleto}>
                        {colaborador.nomeCompleto}
                      </div>
                    </td>
                    <td className="border border-[#3A3A3C] p-2 text-muted text-xs">
                      {colaborador.opsId}
                    </td>
                    <td className="border border-[#3A3A3C] p-2 text-muted text-xs">
                      <div className="truncate max-w-[100px]" title={colaborador.setor}>
                        {colaborador.setor}
                      </div>
                    </td>
                    
                    {/* Colunas das horas */}
                    {horasTurno.map(hora => (
                      <td 
                        key={hora}
                        className={`border border-[#3A3A3C] p-1 text-center text-xs ${obterCorQuantidade(colaborador[hora])}`}
                      >
                        {colaborador[hora] > 0 ? colaborador[hora].toLocaleString('pt-BR') : '0'}
                      </td>
                    ))}
                    
                    <td className={`border border-[#3A3A3C] p-2 text-center font-bold text-xs bg-[#1A4B3A] ${obterCorQuantidade(colaborador.total)}`}>
                      {colaborador.total.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards Mobile/Tablet */}
      <div className="lg:hidden space-y-4">
        {colaboradoresPaginados.map((colaborador, index) => {
          const posicaoGeral = indiceInicio + index + 1;
          return (
            <div key={colaborador.opsId} className="bg-surface-2 rounded-lg p-4 border border-[#3A3A3C]">
              {/* Header do card */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {obterIconeRanking(posicaoGeral)}
                  <span className="text-muted text-sm">#{posicaoGeral}</span>
                </div>
                <div className={`text-lg font-bold ${obterCorQuantidade(colaborador.total)}`}>
                  {colaborador.total.toLocaleString('pt-BR')}
                </div>
              </div>

              {/* Nome e informações */}
              <div className="mb-3">
                <h3 className="text-white font-medium text-sm mb-1">{colaborador.nomeCompleto}</h3>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <span>ID: {colaborador.opsId}</span>
                  <span>•</span>
                  <span>{colaborador.setor}</span>
                </div>
              </div>

              {/* Grid de horas */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {horasTurno.map(hora => (
                  <div key={hora} className="text-center">
                    <div className="text-xs text-muted mb-1">{hora}</div>
                    <div className={`text-sm font-medium ${obterCorQuantidade(colaborador[hora])}`}>
                      {colaborador[hora] > 0 ? colaborador[hora].toLocaleString('pt-BR') : '0'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted">
            Página {paginaAtual} de {totalPaginas}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
              disabled={paginaAtual === 1}
              className="px-3 py-1 bg-surface-2 border border-[#3A3A3C] rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3A3A3C] text-sm"
            >
              Anterior
            </button>
            
            {/* Números das páginas - menos páginas em mobile */}
            {Array.from({ length: Math.min(isMobile ? 3 : 5, totalPaginas) }, (_, i) => {
              let numeroPagina;
              const maxPaginas = isMobile ? 3 : 5;
              
              if (totalPaginas <= maxPaginas) {
                numeroPagina = i + 1;
              } else if (paginaAtual <= Math.ceil(maxPaginas/2)) {
                numeroPagina = i + 1;
              } else if (paginaAtual >= totalPaginas - Math.floor(maxPaginas/2)) {
                numeroPagina = totalPaginas - maxPaginas + 1 + i;
              } else {
                numeroPagina = paginaAtual - Math.floor(maxPaginas/2) + i;
              }
              
              return (
                <button
                  key={numeroPagina}
                  onClick={() => setPaginaAtual(numeroPagina)}
                  className={`px-3 py-1 border border-[#3A3A3C] rounded text-sm ${
                    paginaAtual === numeroPagina
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-2 text-white hover:bg-[#3A3A3C]'
                  }`}
                >
                  {numeroPagina}
                </button>
              );
            })}
            
            <button
              onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
              disabled={paginaAtual === totalPaginas}
              className="px-3 py-1 bg-surface-2 border border-[#3A3A3C] rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3A3A3C] text-sm"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}