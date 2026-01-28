const express = require('express');
const router = express.Router();

// Controllers
const { buscarDwPlanejadoAutomatico } = require('../controllers/dw.controller');
const { postDwReal, getDwReal } = require('../controllers/dwReal.controller');
const { getDwResumo } = require('../controllers/dwResumo.controller');
const { getDwLista } = require('../controllers/dwLista.controller');
// =====================
// DW Planejado (Sheets)
// =====================
router.post('/planejado', buscarDwPlanejadoAutomatico);

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
