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
    console.log("🚀 [SEATALK] Iniciando envio de imagem...")
    console.log("📍 [SEATALK] Group ID:", groupId)
    
    // Obtém o token de acesso
    console.log("🔑 [SEATALK] Obtendo token de acesso...")
    const accessToken = await getAccessToken()
    console.log("✅ [SEATALK] Token obtido com sucesso")

    // Remove o prefixo data:image/png;base64, se existir
    const base64Content = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    const imageSizeKB = Math.round(base64Content.length / 1024)
    const imageSizeMB = (imageSizeKB / 1024).toFixed(2)
    
    console.log("📏 [SEATALK] Tamanho da imagem:", imageSizeKB, "KB (", imageSizeMB, "MB)")
    
    // Verificar se a imagem não é muito grande (limite de 10MB)
    if (imageSizeKB > 10240) {
      throw new Error(`Imagem muito grande (${imageSizeMB}MB). Limite: 10MB`)
    }

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
      
      const textoInfo = `Report Hora x Hora\nData: ${periodoFormatado}\nTurno: ${metadata.turno || 'N/A'}`
      
      console.log("💬 [SEATALK] Enviando texto informativo...")
      
      try {
        const textResponse = await axios.post(
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
        
        if (textResponse.data.code !== 0) {
          console.warn("⚠️ [SEATALK] Erro ao enviar texto:", textResponse.data)
        } else {
          console.log("✅ [SEATALK] Texto enviado com sucesso")
        }
        
        // Aguardar um pouco antes de enviar a imagem
        await new Promise(r => setTimeout(r, 500))
      } catch (textError) {
        console.warn("⚠️ [SEATALK] Erro ao enviar texto (continuando com imagem):", textError.message)
        if (textError.response?.data) {
          console.warn("⚠️ [SEATALK] Resposta do erro:", textError.response.data)
        }
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

    console.log("📦 [SEATALK] Enviando imagem para o grupo...")

    // Faz a requisição POST com autenticação
    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      timeout: 60000, // 60 segundos para imagens grandes
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })

    console.log("📨 [SEATALK] Resposta recebida:", JSON.stringify(response.data, null, 2))

    // Verifica se houve erro na resposta
    if (response.data.code !== 0) {
      const error = createSeatalkError(response.data)
      console.error("❌ [SEATALK] Erro da API:", error.message)
      console.error("💡 [SEATALK] Solução:", getSolution(response.data.code))
      throw error
    }

    console.log("✅ [SEATALK] Imagem enviada com sucesso!")
    return {
      success: true,
      data: response.data,
    }
  } catch (error) {
    console.error("❌ [SEATALK] Erro ao enviar imagem:", error.message)
    
    // Log detalhado do erro
    if (error.response) {
      console.error("📋 [SEATALK] Status:", error.response.status)
      console.error("📋 [SEATALK] Dados:", JSON.stringify(error.response.data, null, 2))
      console.error("📋 [SEATALK] Headers:", error.response.headers)
    } else if (error.request) {
      console.error("📋 [SEATALK] Nenhuma resposta recebida")
      console.error("📋 [SEATALK] Request:", error.request)
    } else {
      console.error("📋 [SEATALK] Erro na configuração:", error.message)
    }
    
    // Criar mensagem de erro mais descritiva
    let errorMessage = "Falha ao enviar imagem para o Seatalk"
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = "Timeout ao enviar imagem. A imagem pode estar muito grande."
    }
    
    throw new Error(errorMessage)
  }
}

module.exports = {
  sendImageToGroup,
  getAccessToken, // Exportar para testes
}
