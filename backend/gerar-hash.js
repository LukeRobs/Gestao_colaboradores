const bcrypt = require("bcrypt");

const senha = process.argv[2]; // pega do terminal

if (!senha) {
  console.log("❌ Informe a senha. Ex: node gerar-hash.js 123456");
  process.exit(1);
}

async function gerarHash() {
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(senha, saltRounds);

    console.log("\n🔐 Senha:", senha);
    console.log("🔑 Hash:", hash);
    console.log("");
  } catch (err) {
    console.error("Erro ao gerar hash:", err);
  }
}

gerarHash();