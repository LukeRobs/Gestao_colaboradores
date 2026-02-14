const axios = require("axios")
const { createSeatalkError, getSolution } = require("../utils/seatalkErrors")

// Cache do token de acesso
let cachedToken = null
let tokenExpiry = null

/**
 * Obtém o token de acesso da API do Seatalk
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  // Verifica se tem token em cache e ainda é válido
  if (cachedToken && tokenExpiry && tokenExpiry > Date.now()) {
    console.log("✅ Usando token em cache")
    return cachedToken
  }

  try {
    const appId = process.env.SEATALK_APP_ID
    const appSecret = process.env.SEATALK_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error(
        "SEATALK_APP_ID e SEATALK_APP_SECRET devem estar configurados no .env"
      )
    }

    console.log("🔑 Obtendo novo token de acesso...")

    const response = await axios.post(
      "https://openapi.seatalk.io/auth/app_access_token",
      {
        app_id: appId,
        app_secret: appSecret,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )

    console.log("📦 Resposta da API:", JSON.stringify(response.data, null, 2))

    if (response.data.code !== 0) {
      const error = createSeatalkError(response.data)
      console.error("❌ Erro da API Seatalk:", error.message)
      console.error("💡 Solução:", getSolution(response.data.code))
      throw error
    }

    // A API retorna o token diretamente em app_access_token
    if (!response.data.app_access_token) {
      console.error("❌ Estrutura de resposta inválida:", response.data)
      throw new Error("Resposta da API não contém app_access_token")
    }

    cachedToken = response.data.app_access_token
    const expiresIn = response.data.expire 
      ? response.data.expire - Math.floor(Date.now() / 1000) 
      : 7200 // Calcula tempo restante ou usa 2 horas padrão

    // Define expiração com 1 minuto de buffer
    tokenExpiry = Date.now() + (expiresIn - 60) * 1000

    console.log(`✅ Token obtido com sucesso (expira em ${expiresIn}s)`)

    return cachedToken
  } catch (error) {
    console.error("❌ Erro ao obter token:", error.response?.data || error.message)
    throw new Error(
      `Falha ao obter token de acesso: ${error.response?.data?.message || error.message}`
    )
  }
}

/**
 * Envia uma imagem para um grupo do Seatalk
 * @param {string} imageBase64 - Imagem em formato base64 (com ou sem prefixo data:image/png;base64,)
 * @param {string} groupId - ID do grupo do Seatalk
 * @param {object} metadata - Metadados do relatório (periodo, turno, etc)
 * @returns {Promise<object>} Resposta da API do Seatalk
 */
async function sendImageToGroup(imageBase64, groupId, metadata = {}) {
  try {
    // Obtém o token de acesso
    const accessToken = await getAccessToken()

    // Remove o prefixo data:image/png;base64, se existir
    const base64Content = imageBase64.replace(/^data:image\/\w+;base64,/, "")

    // Endpoint da API do Seatalk
    const endpoint = "https://openapi.seatalk.io/messaging/v2/group_chat"

    // Se tiver metadados, enviar mensagem de texto primeiro
    if (metadata.periodo || metadata.turno) {
      // Formatar período de forma mais limpa
      let periodoFormatado = metadata.periodo || 'N/A'
      
      // Se o período tiver formato "data → data" e forem iguais, mostrar apenas uma
      if (periodoFormatado.includes('→')) {
        const [inicio, fim] = periodoFormatado.split('→').map(d => d.trim())
        if (inicio === fim) {
          periodoFormatado = inicio
        }
      }
      
      const textoInfo = `Relatório Operacional\ Data: ${periodoFormatado}\n Turno: ${metadata.turno || 'N/A'}`
      
      console.log("💬 Enviando texto informativo...")
      
      try {
        await axios.post(
          endpoint,
          {
            group_id: groupId,
            message: {
              tag: "text",
              text: {
                content: textoInfo,
              },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            timeout: 10000,
          }
        )
        console.log("✅ Texto enviado")
        
        // Aguardar um pouco antes de enviar a imagem
        await new Promise(r => setTimeout(r, 500))
      } catch (textError) {
        console.warn("⚠️ Erro ao enviar texto (continuando com imagem):", textError.message)
      }
    }

    // Payload conforme documentação
    const payload = {
      group_id: groupId,
      message: {
        tag: "image",
        image: {
          content: base64Content,
        },
      },
    }

    console.log("📦 Enviando imagem...")
    console.log("  - group_id:", payload.group_id)
    console.log("  - Tamanho:", Math.round(base64Content.length / 1024), "KB")

    // Faz a requisição POST com autenticação
    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      timeout: 30000, // 30 segundos
    })

    console.log("✅ Resposta da API:", JSON.stringify(response.data, null, 2))

    // Verifica se houve erro na resposta
    if (response.data.code !== 0) {
      const error = createSeatalkError(response.data)
      console.error("❌ Erro da API Seatalk:", error.message)
      console.error("💡 Solução:", getSolution(response.data.code))
      throw error
    }

    return {
      success: true,
      data: response.data,
    }
  } catch (error) {
    console.error("❌ Erro ao enviar imagem para Seatalk:", error.response?.data || error.message)
    
    throw new Error(
      error.response?.data?.message || 
      error.message ||
      "Falha ao enviar imagem para o Seatalk"
    )
  }
}

module.exports = {
  sendImageToGroup,
  getAccessToken, // Exportar para testes
}
