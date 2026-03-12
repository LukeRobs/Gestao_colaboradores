const { google } = require("googleapis");

/* =====================================================
   CONFIG
===================================================== */

const META_SPREADSHEET_ID = "17Dpmr1Kn6ybvK3rah2JvoCBsAeOvotvM6k_7uaATPz0";
const META_SHEET = "Meta";
const ATUALIZACAO_SHEET = "Atualização_colaborador";

/* =====================================================
   CACHE
===================================================== */

let sheetCache = null;
let cacheTimestamp = null;
let atualizacaoCache = null;
let atualizacaoCacheTimestamp = null;
const CACHE_TTL = 1 * 60 * 1000; // 1 min (reduzido de 5 min)

function isCacheValid() {
  return (
    sheetCache &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TTL
  );
}

function isAtualizacaoCacheValid() {
  return (
    atualizacaoCache &&
    atualizacaoCacheTimestamp &&
    Date.now() - atualizacaoCacheTimestamp < CACHE_TTL
  );
}

function limparCache() {
  sheetCache = null;
  cacheTimestamp = null;
  atualizacaoCache = null;
  atualizacaoCacheTimestamp = null;
  console.log("🗑️ Cache limpo");
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

  return google.sheets({
    version: "v4",
    auth,
    retry: false,
  });
};

/* =====================================================
   HELPERS
===================================================== */

const formatarData = (dataISO) => {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
};

const normalizar = (v) =>
  String(v ?? "")
    .replace(/\u00A0/g, " ")
    .trim();

/* =====================================================
   CARREGAR PLANILHA
===================================================== */

async function carregarPlanilha() {
  if (isCacheValid()) {
    console.log("📦 Meta retornada do cache");
    return sheetCache;
  }

  console.log("🌎 Buscando Meta no Google Sheets...");

  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: META_SPREADSHEET_ID,
    range: `${META_SHEET}!A:E`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) {
    throw new Error("Aba Meta vazia");
  }

  sheetCache = rows;
  cacheTimestamp = Date.now();

  console.log("✅ Meta armazenada em cache");

  return rows;
}

/* =====================================================
   CARREGAR PLANILHA ATUALIZAÇÃO
===================================================== */

async function carregarAtualizacaoColaborador() {
  if (isAtualizacaoCacheValid()) {
    console.log("📦 Atualização_colaborador retornada do cache");
    return atualizacaoCache;
  }

  console.log("🌎 Buscando Atualização_colaborador no Google Sheets...");

  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: META_SPREADSHEET_ID,
    range: `${ATUALIZACAO_SHEET}!A:ZZ`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) {
    throw new Error("Aba Atualização_colaborador vazia");
  }

  atualizacaoCache = rows;
  atualizacaoCacheTimestamp = Date.now();

  console.log("✅ Atualização_colaborador armazenada em cache");

  return rows;
}

/* =====================================================
   BUSCAR METAS POR TURNO E DATA
===================================================== */

async function buscarMetasProducao(turno, dataISO) {
  try {
    console.log("🔍 Iniciando busca de metas:", { turno, dataISO });
    
    const rows = await carregarPlanilha();
    const dataBusca = formatarData(dataISO);

    console.log("� Planilha carregada:", rows.length, "linhas");
    console.log("�🔍 Buscando metas para:", { turno, data: dataBusca });

    // Estrutura esperada: Data | Hora | Esteira | Meta | Turno
    const metasPorHora = {};
    let metaDia = 0;
    let linhasEncontradas = 0;

    // Pular header (linha 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length < 4) continue;

      const dataRow = normalizar(row[0]);
      const horaRaw = normalizar(row[1]);
      const hora = parseInt(horaRaw);
      const esteira = normalizar(row[2]);
      
      // Tratar números no formato brasileiro
      const metaOriginal = String(row[3] || '0').trim();
      let metaStr = metaOriginal;
      
      if (metaOriginal.includes('.') && metaOriginal.includes(',')) {
        metaStr = metaOriginal.replace(/\./g, '').replace(',', '.');
      } else if (metaOriginal.includes(',') && !metaOriginal.includes('.')) {
        const partes = metaOriginal.split(',');
        if (partes[1] && partes[1].length === 3) {
          metaStr = metaOriginal.replace(',', '');
        } else {
          metaStr = metaOriginal.replace(',', '.');
        }
      }
      
      const meta = parseFloat(metaStr) || 0;
      
      // Inferir turno pela hora se não estiver na planilha
      let turnoRow = row[4] ? normalizar(row[4]) : null;
      
      if (!turnoRow) {
        // T1: 6-13h, T2: 14-21h, T3: 22-5h
        if (hora >= 6 && hora <= 13) {
          turnoRow = 'T1';
        } else if (hora >= 14 && hora <= 21) {
          turnoRow = 'T2';
        } else {
          turnoRow = 'T3';
        }
      }

      // Debug das primeiras 10 linhas
      if (i <= 10) {
        console.log(`Linha ${i}:`, { 
          dataRow, 
          horaRaw, 
          hora, 
          esteira, 
          metaOriginal,
          metaStr,
          meta, 
          turnoRow 
        });
      }

      // Filtrar por data e turno
      if (dataRow === dataBusca && turnoRow === turno && !isNaN(hora)) {
        linhasEncontradas++;
        
        if (!metasPorHora[hora]) {
          metasPorHora[hora] = 0;
        }
        
        metasPorHora[hora] += meta;
        metaDia += meta;

        if (linhasEncontradas <= 10) {
          console.log(`✅ Match encontrado:`, { 
            hora, 
            esteira, 
            metaOriginal,
            metaStr,
            meta, 
            totalHora: metasPorHora[hora] 
          });
        }
      }
    }

    console.log("✅ Metas encontradas:", { 
      metaDia, 
      horas: Object.keys(metasPorHora).length,
      linhasEncontradas,
      metasPorHora 
    });

    if (linhasEncontradas === 0) {
      console.warn("⚠️ Nenhuma linha encontrada para:", { turno, data: dataBusca });
      console.warn("📋 Primeiras 5 linhas da planilha:");
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        console.warn(`Linha ${i}:`, rows[i]);
      }
    }

    return {
      success: true,
      data: {
        dataConsultada: dataBusca,
        turnoConsultado: turno,
        metaDia,
        metasPorHora,
      },
    };
  } catch (error) {
    console.error("❌ Erro ao buscar metas:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}

/* =====================================================
   BUSCAR QUANTIDADE REALIZADA POR HORA
===================================================== */

async function buscarQuantidadeRealizada(dataISO) {
  try {
    console.log("🔍 Iniciando busca de quantidade realizada:", { dataISO });
    
    const rows = await carregarAtualizacaoColaborador();
    const dataBusca = formatarData(dataISO);

    console.log("📊 Planilha Atualização carregada:", rows.length, "linhas");

    if (!rows || rows.length < 5) {
      console.warn("⚠️ Planilha vazia ou sem dados suficientes");
      return { success: false, data: {} };
    }

    // Estrutura da planilha:
    // Linha 0: "Atualização Automatica da sheets"
    // Linha 1: "Soma Total Por Hora" | valor_hora1 | valor_hora2 | ...
    // Linha 2: "" | timestamp1 | timestamp2 | ...
    // Linha 3: "" | data1 | data2 | ...
    // Linha 4: "" | hora1 | hora2 | ...
    // Linha 5+: colaboradores com suas quantidades

    const linhaSomaTotalPorHora = rows[1]; // Linha com "Soma Total Por Hora"
    const linhaDatas = rows[3]; // Linha com as datas
    const linhaHoras = rows[4]; // Linha com as horas

    console.log("📋 Total de colunas:", linhaSomaTotalPorHora.length);
    console.log("📋 Primeira coluna da linha 1:", linhaSomaTotalPorHora[0]);
    console.log("📋 Primeiras 10 datas:", linhaDatas.slice(0, 10));
    console.log("📋 Primeiras 10 horas:", linhaHoras.slice(0, 10));

    // Extrair quantidades por hora
    const quantidadePorHora = {};
    
    // Começar da coluna 1 (coluna 0 é o label)
    for (let colIndex = 1; colIndex < linhaSomaTotalPorHora.length; colIndex++) {
      const dataColuna = normalizar(linhaDatas[colIndex]);
      const horaColuna = normalizar(linhaHoras[colIndex]);
      const valorColuna = linhaSomaTotalPorHora[colIndex];

      // Verificar se a data corresponde
      if (dataColuna !== dataBusca) {
        continue;
      }

      // Extrair hora (formato: "09:00", "08:00", etc)
      const horaMatch = horaColuna.match(/^(\d{1,2})/);
      if (!horaMatch) {
        continue;
      }

      const hora = parseInt(horaMatch[1]);
      
      if (hora < 0 || hora > 23) {
        continue;
      }

      // Converter valor para número
      if (valorColuna && valorColuna !== "") {
        const valorStr = String(valorColuna).trim().replace(/\./g, '').replace(',', '.');
        const quantidade = parseFloat(valorStr) || 0;

        if (quantidade > 0) {
          quantidadePorHora[hora] = (quantidadePorHora[hora] || 0) + quantidade;
          
          // Log apenas das primeiras 15 horas encontradas
          if (Object.keys(quantidadePorHora).length <= 15) {
            console.log(`  ✅ Hora ${hora.toString().padStart(2, '0')} (col ${colIndex}): ${quantidade}`);
          }
        }
      }
    }

    console.log("\n📊 RESUMO - Quantidades por hora extraídas:");
    console.log(JSON.stringify(quantidadePorHora, null, 2));

    return {
      success: true,
      data: quantidadePorHora
    };
  } catch (error) {
    console.error("❌ Erro ao buscar quantidade realizada:", error.message);
    console.error("Stack:", error.stack);
    return { success: false, data: {} };
  }
}

/* =====================================================
   BUSCAR RANKING DE COLABORADORES
===================================================== */

async function buscarRankingColaboradores(dataISO, limite = 15) {
  try {
    console.log("🔍 Iniciando busca de ranking de colaboradores:", { dataISO, limite });
    
    const rows = await carregarAtualizacaoColaborador();
    const dataBusca = formatarData(dataISO);

    console.log("📊 Planilha Atualização carregada:", rows.length, "linhas");

    if (!rows || rows.length < 5) {
      console.warn("⚠️ Planilha vazia ou sem dados suficientes");
      return { success: false, data: [] };
    }

    // Estrutura da planilha:
    // Linha 0: "Atualização Automatica da sheets"
    // Linha 1: "Soma Total Por Hora" | valor_hora1 | valor_hora2 | ...
    // Linha 2: "" | timestamp1 | timestamp2 | ...
    // Linha 3: "" | data1 | data2 | ...
    // Linha 4: "" | hora1 | hora2 | ...
    // Linha 5+: Nome_Colaborador | quantidade_hora1 | quantidade_hora2 | ...

    const linhaDatas = rows[3]; // Linha com as datas
    
    // Identificar colunas que correspondem à data buscada
    const colunasData = [];
    for (let colIndex = 1; colIndex < linhaDatas.length; colIndex++) {
      const dataColuna = normalizar(linhaDatas[colIndex]);
      if (dataColuna === dataBusca) {
        colunasData.push(colIndex);
      }
    }

    console.log(`📋 Encontradas ${colunasData.length} colunas para a data ${dataBusca}`);

    if (colunasData.length === 0) {
      console.warn("⚠️ Nenhuma coluna encontrada para a data:", dataBusca);
      return { success: false, data: [] };
    }

    // Processar colaboradores (linhas 5+)
    const colaboradores = [];
    
    for (let rowIndex = 5; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      
      if (!row || row.length === 0) continue;
      
      const nomeColaborador = normalizar(row[0]);
      
      // Ignorar linhas vazias, totais ou "User Email"
      if (!nomeColaborador || 
          nomeColaborador.toLowerCase().includes('total') ||
          nomeColaborador.toLowerCase().includes('user email') ||
          nomeColaborador === 'User Email') {
        continue;
      }

      // Somar produção de todas as colunas da data
      let totalProducao = 0;
      
      for (const colIndex of colunasData) {
        const valorColuna = row[colIndex];
        
        if (valorColuna && valorColuna !== "") {
          const valorStr = String(valorColuna).trim().replace(/\./g, '').replace(',', '.');
          const quantidade = parseFloat(valorStr) || 0;
          totalProducao += quantidade;
        }
      }

      if (totalProducao > 0) {
        colaboradores.push({
          nome: nomeColaborador,
          total: totalProducao
        });
      }
    }

    // Ordenar por total decrescente e pegar top N
    colaboradores.sort((a, b) => b.total - a.total);
    const ranking = colaboradores.slice(0, limite);

    console.log(`✅ Ranking gerado: ${ranking.length} colaboradores`);
    if (ranking.length > 0) {
      console.log("🏆 Top 3:");
      ranking.slice(0, 3).forEach((c, i) => {
        console.log(`  ${i + 1}º - ${c.nome}: ${c.total}`);
      });
    }

    return {
      success: true,
      data: ranking
    };
  } catch (error) {
    console.error("❌ Erro ao buscar ranking de colaboradores:", error.message);
    console.error("Stack:", error.stack);
    return { success: false, data: [] };
  }
}

module.exports = {
  buscarMetasProducao,
  buscarQuantidadeRealizada,
  buscarRankingColaboradores,
  limparCache,
};
