const { google } = require("googleapis");

/* =====================================================
   CONFIG
===================================================== */

// ID padrão (fallback para ADMIN sem estação configurada)
const DEFAULT_SPREADSHEET_ID = "17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0";
const META_SHEET = "Meta";
const ATUALIZACAO_SHEET = "Atualização_colaborador";
const LOGIC_SHEET = "Logic";

/* =====================================================
   CACHE POR SPREADSHEET ID
===================================================== */

// Estrutura: { [spreadsheetId]: { meta, atualizacao, logic, timestamps } }
const cacheMap = new Map();
const CACHE_TTL = 1 * 60 * 1000; // 1 min

function getCache(spreadsheetId) {
  if (!cacheMap.has(spreadsheetId)) {
    cacheMap.set(spreadsheetId, {
      meta: null, metaTs: null,
      atualizacao: null, atualizacaoTs: null,
      logic: null, logicTs: null,
    });
  }
  return cacheMap.get(spreadsheetId);
}

function isCacheValid(ts) {
  return ts && Date.now() - ts < CACHE_TTL;
}

function limparCache(spreadsheetId) {
  if (spreadsheetId) {
    cacheMap.delete(spreadsheetId);
    console.log(`🗑️ Cache limpo para ${spreadsheetId}`);
  } else {
    cacheMap.clear();
    console.log("🗑️ Todo cache limpo");
  }
}

/* =====================================================
   GOOGLE CLIENT
===================================================== */

const getGoogleSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth, retry: false });
};

/* =====================================================
   HELPERS
===================================================== */

const formatarData = (dataISO) => {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

const normalizar = (v) =>
  String(v ?? "").replace(/\u00A0/g, " ").trim();

/* =====================================================
   CARREGAR ABAS
===================================================== */

async function carregarPlanilha(spreadsheetId) {
  const cache = getCache(spreadsheetId);
  if (isCacheValid(cache.metaTs)) {
    console.log("📦 Meta retornada do cache");
    return cache.meta;
  }

  console.log(`🌎 Buscando Meta no Google Sheets [${spreadsheetId}]...`);
  const sheets = getGoogleSheetsClient();

  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${META_SHEET}!A:E`,
      valueRenderOption: "FORMATTED_VALUE",
    });
  } catch (err) {
    // Aba não existe ou planilha não configurada
    const msg = err?.message || '';
    if (msg.includes('Unable to parse range') || msg.includes('404') || msg.includes('not found')) {
      const e = new Error(`Planilha não configurada para esta estação`);
      e.code = 'SHEETS_NOT_CONFIGURED';
      throw e;
    }
    throw err;
  }

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    const e = new Error(`Planilha não configurada para esta estação`);
    e.code = 'SHEETS_NOT_CONFIGURED';
    throw e;
  }

  cache.meta = rows;
  cache.metaTs = Date.now();
  console.log("✅ Meta armazenada em cache");
  return rows;
}

async function carregarAtualizacaoColaborador(spreadsheetId) {
  const cache = getCache(spreadsheetId);
  if (isCacheValid(cache.atualizacaoTs)) {
    console.log("📦 Atualização_colaborador retornada do cache");
    return cache.atualizacao;
  }

  console.log(`🌎 Buscando Atualização_colaborador no Google Sheets [${spreadsheetId}]...`);
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${ATUALIZACAO_SHEET}!A:ZZ`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) throw new Error("Aba Atualização_colaborador vazia");

  cache.atualizacao = rows;
  cache.atualizacaoTs = Date.now();
  console.log("✅ Atualização_colaborador armazenada em cache");
  return rows;
}

async function carregarLogic(spreadsheetId) {
  const cache = getCache(spreadsheetId);
  if (isCacheValid(cache.logicTs)) {
    console.log("📦 Logic retornada do cache");
    return cache.logic;
  }

  console.log(`🌎 Buscando Logic no Google Sheets [${spreadsheetId}]...`);
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${LOGIC_SHEET}!A:B`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) throw new Error("Aba Logic vazia");

  cache.logic = rows;
  cache.logicTs = Date.now();
  console.log("✅ Logic armazenada em cache");
  return rows;
}


/* =====================================================
   BUSCAR METAS POR TURNO E DATA
===================================================== */

async function buscarMetasProducao(turno, dataISO, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  try {
    console.log("🔍 Iniciando busca de metas:", { turno, dataISO, spreadsheetId });
    
    const rows = await carregarPlanilha(spreadsheetId);
    const dataBusca = formatarData(dataISO);

    const metasPorHora = {};
    let metaDia = 0;
    let linhasEncontradas = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;

      const dataRow = normalizar(row[0]);
      const horaRaw = normalizar(row[1]);
      const hora = parseInt(horaRaw);
      
      const metaOriginal = String(row[3] || '0').trim();
      let metaStr = metaOriginal;
      
      if (metaOriginal.includes('.') && metaOriginal.includes(',')) {
        metaStr = metaOriginal.replace(/\./g, '').replace(',', '.');
      } else if (metaOriginal.includes(',') && !metaOriginal.includes('.')) {
        const partes = metaOriginal.split(',');
        metaStr = partes[1]?.length === 3
          ? metaOriginal.replace(',', '')
          : metaOriginal.replace(',', '.');
      }
      
      const meta = parseFloat(metaStr) || 0;
      
      let turnoRow = row[4] ? normalizar(row[4]) : null;
      if (!turnoRow) {
        if (hora >= 6 && hora <= 13) turnoRow = 'T1';
        else if (hora >= 14 && hora <= 21) turnoRow = 'T2';
        else turnoRow = 'T3';
      }

      if (dataRow === dataBusca && turnoRow === turno && !isNaN(hora)) {
        linhasEncontradas++;
        metasPorHora[hora] = (metasPorHora[hora] || 0) + meta;
        metaDia += meta;
      }
    }

    if (linhasEncontradas === 0) {
      console.warn("⚠️ Nenhuma linha encontrada para:", { turno, data: dataBusca, spreadsheetId });
    }

    return {
      success: true,
      data: { dataConsultada: dataBusca, turnoConsultado: turno, metaDia, metasPorHora },
    };
  } catch (error) {
    console.error("❌ Erro ao buscar metas:", error.message);
    throw error;
  }
}

/* =====================================================
   BUSCAR QUANTIDADE REALIZADA POR HORA
===================================================== */

async function buscarQuantidadeRealizada(dataISO, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  try {
    const rows = await carregarAtualizacaoColaborador(spreadsheetId);
    const dataBusca = formatarData(dataISO);

    if (!rows || rows.length < 5) return { success: false, data: {} };

    const linhaSomaTotalPorHora = rows[1];
    const linhaDatas = rows[3];
    const linhaHoras = rows[4];

    const quantidadePorHora = {};
    
    for (let colIndex = 1; colIndex < linhaSomaTotalPorHora.length; colIndex++) {
      const dataColuna = normalizar(linhaDatas[colIndex]);
      const horaColuna = normalizar(linhaHoras[colIndex]);
      const valorColuna = linhaSomaTotalPorHora[colIndex];

      if (dataColuna !== dataBusca) continue;

      const horaMatch = horaColuna.match(/^(\d{1,2})/);
      if (!horaMatch) continue;

      const hora = parseInt(horaMatch[1]);
      if (hora < 0 || hora > 23) continue;

      if (valorColuna && valorColuna !== "") {
        const valorStr = String(valorColuna).trim().replace(/\./g, '').replace(',', '.');
        const quantidade = parseFloat(valorStr) || 0;
        if (quantidade > 0) {
          quantidadePorHora[hora] = (quantidadePorHora[hora] || 0) + quantidade;
        }
      }
    }

    return { success: true, data: quantidadePorHora };
  } catch (error) {
    console.error("❌ Erro ao buscar quantidade realizada:", error.message);
    return { success: false, data: {} };
  }
}

/* =====================================================
   BUSCAR RANKING DE COLABORADORES
===================================================== */

async function buscarRankingColaboradores(dataISO, turno, limite = 15, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  try {
    const rows = await carregarAtualizacaoColaborador(spreadsheetId);
    const logicRows = await carregarLogic(spreadsheetId);
    const dataBusca = formatarData(dataISO);

    let dataBuscaExtra = null;
    if (turno === 'T3') {
      const dataObj = new Date(dataISO);
      dataObj.setDate(dataObj.getDate() + 1);
      dataBuscaExtra = formatarData(dataObj.toISOString().slice(0, 10));
    }

    if (!rows || rows.length < 5) return { success: false, data: [] };

    const colaboradoresPorTurno = new Map();
    for (let i = 1; i < logicRows.length; i++) {
      const row = logicRows[i];
      if (!row || row.length < 2) continue;
      const nome = normalizar(row[0]);
      const turnoColaborador = normalizar(row[1]);
      if (nome && turnoColaborador) {
        colaboradoresPorTurno.set(nome.toLowerCase(), turnoColaborador);
      }
    }

    const linhaDatas = rows[3];
    const linhaHoras = rows[4];
    
    const colunasData = [];
    for (let colIndex = 1; colIndex < linhaDatas.length; colIndex++) {
      const dataColuna = normalizar(linhaDatas[colIndex]);
      const horaColuna = normalizar(linhaHoras[colIndex]);
      const hora = parseInt(horaColuna.split(':')[0]);

      if (dataColuna === dataBusca) {
        if (turno === 'T3') { if (hora >= 22) colunasData.push(colIndex); }
        else colunasData.push(colIndex);
      } else if (dataBuscaExtra && dataColuna === dataBuscaExtra) {
        if (hora < 6) colunasData.push(colIndex);
      }
    }

    if (colunasData.length === 0) return { success: false, data: [] };

    const colaboradores = [];
    for (let rowIndex = 5; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || row.length === 0) continue;
      
      const nomeColaborador = normalizar(row[0]);
      if (!nomeColaborador || 
          nomeColaborador.toLowerCase().includes('total') ||
          nomeColaborador.toLowerCase().includes('user email') ||
          nomeColaborador === 'User Email') continue;

      const turnoColaborador = colaboradoresPorTurno.get(nomeColaborador.toLowerCase());
      if (!turnoColaborador || turnoColaborador !== turno) continue;

      let totalProducao = 0;
      for (const colIndex of colunasData) {
        const valorColuna = row[colIndex];
        if (valorColuna && valorColuna !== "") {
          const valorStr = String(valorColuna).trim().replace(/\./g, '').replace(',', '.');
          totalProducao += parseFloat(valorStr) || 0;
        }
      }

      if (totalProducao > 0) colaboradores.push({ nome: nomeColaborador, total: totalProducao });
    }

    colaboradores.sort((a, b) => b.total - a.total);
    return { success: true, data: colaboradores.slice(0, limite) };
  } catch (error) {
    console.error("❌ Erro ao buscar ranking de colaboradores:", error.message);
    return { success: false, data: [] };
  }
}

/* =====================================================
   BUSCAR PRODUTIVIDADE DETALHADA POR COLABORADOR
===================================================== */

async function buscarProdutividadeDetalhada(dataISO, turno, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  try {
    const rows = await carregarAtualizacaoColaborador(spreadsheetId);
    const logicRows = await carregarLogic(spreadsheetId);
    const dataBusca = formatarData(dataISO);

    let dataBuscaExtra = null;
    if (turno === 'T3') {
      const dataObj = new Date(dataISO);
      dataObj.setDate(dataObj.getDate() + 1);
      dataBuscaExtra = formatarData(dataObj.toISOString().slice(0, 10));
    }

    if (!rows || rows.length < 5) return { success: false, data: [] };

    const extrairOpsId = (str) => {
      const match = String(str).match(/\[([^\]]+)\]/);
      return match ? match[1].toLowerCase() : null;
    };

    const extrairNomeLimpo = (str) =>
      String(str).replace(/^\[[^\]]+\]/, '').trim();

    const colaboradoresPorTurno = new Map();
    for (let i = 1; i < logicRows.length; i++) {
      const row = logicRows[i];
      if (!row || row.length < 2) continue;
      const celula = normalizar(row[0]);
      const turnoColaborador = normalizar(row[1]);
      if (!celula || !turnoColaborador) continue;
      const opsId = extrairOpsId(celula);
      if (opsId) colaboradoresPorTurno.set(opsId, turnoColaborador);
    }

    const linhaDatas = rows[3];
    const linhaHoras = rows[4];

    const colunasData = [];
    for (let colIndex = 1; colIndex < linhaDatas.length; colIndex++) {
      const dataColuna = normalizar(linhaDatas[colIndex]);
      const horaColuna = normalizar(linhaHoras[colIndex]);
      const hora = parseInt(horaColuna.split(':')[0]);

      if (dataColuna === dataBusca) {
        if (turno === 'T3') { if (hora >= 22) colunasData.push(colIndex); }
        else colunasData.push(colIndex);
      } else if (dataBuscaExtra && dataColuna === dataBuscaExtra) {
        if (hora < 6) colunasData.push(colIndex);
      }
    }

    if (colunasData.length === 0) return { success: true, data: [] };

    const colaboradores = [];
    for (let rowIndex = 5; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || row.length === 0) continue;
      
      const nomeColaborador = normalizar(row[0]);
      if (!nomeColaborador || 
          nomeColaborador.toLowerCase().includes('total') ||
          nomeColaborador.toLowerCase().includes('user email') ||
          nomeColaborador === 'User Email') continue;

      const opsIdLinha = extrairOpsId(nomeColaborador);
      const nomeLimpoLinha = extrairNomeLimpo(nomeColaborador);
      if (!opsIdLinha) continue;

      const turnoColaborador = colaboradoresPorTurno.get(opsIdLinha);
      if (!turnoColaborador || turnoColaborador !== turno) continue;

      const dadosPorHora = {};
      let totalProducao = 0;
      
      for (const colIndex of colunasData) {
        const horaStr = normalizar(linhaHoras[colIndex]);
        const valorColuna = row[colIndex];
        
        if (horaStr) {
          const hora = parseInt(horaStr.split(':')[0]);
          if (!isNaN(hora)) {
            let quantidade = 0;
            if (valorColuna && valorColuna !== "") {
              const valorStr = String(valorColuna).trim().replace(/\./g, '').replace(',', '.');
              quantidade = Math.round(parseFloat(valorStr) || 0);
            }
            dadosPorHora[hora] = (dadosPorHora[hora] || 0) + quantidade;
            totalProducao += quantidade;
          }
        }
      }

      colaboradores.push({
        nome: nomeLimpoLinha || nomeColaborador,
        opsId: opsIdLinha,
        dadosPorHora,
        total: totalProducao
      });
    }

    console.log(`✅ Produtividade detalhada: ${colaboradores.length} colaboradores do ${turno}`);
    return { success: true, data: colaboradores };
  } catch (error) {
    console.error("❌ Erro ao buscar produtividade detalhada:", error.message);
    return { success: false, data: [] };
  }
}

module.exports = {
  buscarMetasProducao,
  buscarQuantidadeRealizada,
  buscarRankingColaboradores,
  buscarProdutividadeDetalhada,
  limparCache,
  DEFAULT_SPREADSHEET_ID,
};
