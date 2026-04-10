require('dotenv').config();
const { buscarDwLista } = require('../src/services/dwLista.service');

async function main() {
  console.log('=== Teste 1: 2026-04-09 (ontem) ===');
  const res1 = await buscarDwLista({ data: '2026-04-09', idEstacao: 1 });
  console.log('Registros:', res1.length);
  res1.forEach(r => console.log(` - ${r.data} ${r.turno}: planejado=${r.planejado}, real=${r.totalReal}`));

  console.log('\n=== Teste 2: 2026-03-29 ===');
  const res2 = await buscarDwLista({ data: '2026-03-29', idEstacao: 1 });
  console.log('Registros:', res2.length);
  res2.forEach(r => console.log(` - ${r.data} ${r.turno}: planejado=${r.planejado}, real=${r.totalReal}`));
}

main().catch(console.error);
