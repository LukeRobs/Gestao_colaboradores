const express = require('express');
const router = express.Router();

const { buscarDwPlanejadoAutomatico, postDwPlanejadoManual, getDwPlanejadoManual, getDwPlanejadoCalculadora } = require('../controllers/dw.controller');
const { postDwReal, getDwReal } = require('../controllers/dwReal.controller');
const { getDwResumo } = require('../controllers/dwResumo.controller');
const { getDwLista } = require('../controllers/dwLista.controller');

// =====================
// DW Planejado (Sheets - Estação 1)
// =====================
router.post('/planejado', buscarDwPlanejadoAutomatico);

// =====================
// DW Planejado Manual (Estações != 1)
// =====================
router.post('/planejado/manual', postDwPlanejadoManual);
router.get('/planejado/manual', getDwPlanejadoManual);
router.get('/planejado/calculadora', getDwPlanejadoCalculadora);

// =====================
// DW Real (Banco)
// =====================
router.post('/real', postDwReal);
router.get('/real', getDwReal);

// =====================
// DW Resumo (Tela)
// =====================
router.get('/resumo', getDwResumo);

router.get('/lista', getDwLista);
module.exports = router;
