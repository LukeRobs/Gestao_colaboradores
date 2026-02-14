const axios = require("axios")

/**
 * Envia mensagem via webhook do Seatalk (método alternativo)
 * @param {string} webhookUrl - URL completa do webhook
 * @param {string} text - Texto da mensagem
 * @returns {Promise<object>}
 */
async function sendTextViaWebhook(webhookUrl, text) {
  try {
    console.log("📤 Enviando via webhook...")
    console.log("🔗 URL:", webhookUrl)

    const response = await axios.post(
      webhookUrl,
      {
        text: text,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )

    console.log("✅ Resposta:", response.data)
    return { success: true, data: response.data }
  } catch (error) {
    console.error("❌ Erro:", error.response?.data || error.message)
    throw error
  }
}

/**
 * Envia imagem via webhook (se suportado)
 * @param {string} webhookUrl - URL completa do webhook
 * @param {string} imageBase64 - Imagem em base64
 * @param {string} text - Texto opcional para acompanhar a imagem
 * @returns {Promise<object>}
 */
async function sendImageViaWebhook(webhookUrl, imageBase64, text = null) {
  try {
    const base64Content = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    
    console.log("📤 Enviando imagem via webhook...")
    console.log("🔗 URL:", webhookUrl)
    console.log("📏 Tamanho:", Math.round(base64Content.length / 1024), "KB")
    if (text) console.log("💬 Texto:", text)

    // Tentar apenas com imagem (como no teste que funcionou)
    const payload = {
      tag: "image",
      content: base64Content,
    }

    console.log("📦 Payload keys:", Object.keys(payload))

    const response = await axios.post(
      webhookUrl,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    )

    console.log("✅ Resposta completa:", JSON.stringify(response.data, null, 2))
    
    // Verificar se realmente teve sucesso
    if (response.data.code !== 0) {
      console.error("❌ Webhook retornou código:", response.data.code)
      console.error("❌ Mensagem:", response.data.message || response.data.msg)
      throw new Error(`Webhook erro (${response.data.code}): ${response.data.message || response.data.msg || 'erro desconhecido'}`)
    }
    
    return { success: true, data: response.data }
  } catch (error) {
    console.error("❌ Erro completo:", error.response?.data || error.message)
    throw error
  }
}

module.exports = {
  sendTextViaWebhook,
  sendImageViaWebhook,
}
