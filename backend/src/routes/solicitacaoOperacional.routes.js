const express = require("express");
const router = express.Router();

const solicitacaoController = require("../controllers/solicitacaoOperacional.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const { upload, handleMulterError } = require("../middlewares/uploadCsv.middleware");

const roles = ["ADMIN", "ALTA_GESTAO", "LIDERANCA"];

/* BUSCA INTELIGENTE POR CPF (autofill dos formulários) */
router.get("/colaborador", authenticate, authorize(...roles), solicitacaoController.buscarColaboradorPorCpf);

/* ESCALAS ATIVAS DA ESTAÇÃO (formulário de Troca de Escala) */
router.get("/escalas", authenticate, authorize(...roles), solicitacaoController.listarEscalasAtivas);

/* TURNOS ATIVOS DA ESTAÇÃO (formulário de Troca de Turno) */
router.get("/turnos", authenticate, authorize(...roles), solicitacaoController.listarTurnosAtivos);

/* EMPRESAS SPX/DIRETAS DA ESTAÇÃO (formulário de Internalização) */
router.get("/empresas-internalizacao", authenticate, authorize(...roles), solicitacaoController.listarEmpresasInternalizacao);

/* CHECAGEM PRÉVIA DE ELEGIBILIDADE PARA INTERNALIZAÇÃO */
router.get("/elegibilidade-internalizacao", authenticate, authorize(...roles), solicitacaoController.verificarElegibilidadeInternalizacaoHandler);

/* CALENDÁRIO */
router.get("/calendario", authenticate, authorize(...roles), solicitacaoController.listarCalendario);

/* STATS (CARDS) */
router.get("/stats", authenticate, authorize(...roles), solicitacaoController.statsSolicitacoes);

/* IDs APROVÁVEIS PELO FILTRO ATUAL (seleção "todos os resultados") */
router.get("/aprovaveis/ids", authenticate, authorize(...roles), solicitacaoController.listarIdsAprovaveis);

/* IMPORTAR FOLGA EM LOTE (CSV) */
router.post(
  "/folga/importar",
  authenticate,
  authorize(...roles),
  upload.single("file"),
  handleMulterError,
  solicitacaoController.importarFolgaLote
);

/* IMPORTAR SINERGIA EM LOTE (CSV) */
router.post(
  "/sinergia/importar",
  authenticate,
  authorize(...roles),
  upload.single("file"),
  handleMulterError,
  solicitacaoController.importarSinergiaLote
);

/* IMPORTAR BANCO DE HORAS EM LOTE (CSV) */
router.post(
  "/banco-horas/importar",
  authenticate,
  authorize(...roles),
  upload.single("file"),
  handleMulterError,
  solicitacaoController.importarBancoHorasLote
);

/* IMPORTAR INTERNALIZAÇÃO EM LOTE (CSV) */
router.post(
  "/internalizacao/importar",
  authenticate,
  authorize(...roles),
  upload.single("file"),
  handleMulterError,
  solicitacaoController.importarInternalizacaoLote
);

/* CRIAR SOLICITAÇÃO */
router.post("/", authenticate, authorize(...roles), solicitacaoController.createSolicitacao);

/* LISTAR SOLICITAÇÕES */
router.get("/", authenticate, authorize(...roles), solicitacaoController.listSolicitacoes);

/* BUSCAR SOLICITAÇÃO POR ID */
router.get("/:id", authenticate, authorize(...roles), solicitacaoController.getSolicitacao);

/* APROVAR SOLICITAÇÃO */
router.post("/:id/aprovar", authenticate, authorize(...roles), solicitacaoController.aprovarSolicitacao);

/* REPROVAR SOLICITAÇÃO */
router.post("/:id/reprovar", authenticate, authorize(...roles), solicitacaoController.reprovarSolicitacao);

module.exports = router;
