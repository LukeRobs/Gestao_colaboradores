const express = require("express");
const router = express.Router();
const multer = require("multer");

const treinamentoController = require("../controllers/treinamento.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

// Multer em memória — limite 20 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Apenas arquivos PDF são aceitos"), false);
  },
});

// Multer para planilhas (xlsx/xls/csv)
const uploadPlanilha = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos XLSX, XLS ou CSV são aceitos"), false);
    }
  },
});

/* =====================================================
   TREINAMENTOS
===================================================== */

/* LISTAR PARTICIPANTES POR SETOR */
router.get(
  "/participantes",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.listParticipantesPorSetor
);

/* IMPORTAR TREINAMENTO VIA PLANILHA */
router.post(
  "/import",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO"),
  uploadPlanilha.single("file"),
  treinamentoController.importTreinamento
);

/* CRIAR TREINAMENTO */
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.createTreinamento
);

/* STATS TREINAMENTOS */
router.get(
  "/stats",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.statsTreinamentos
);

/* LISTAR TREINAMENTOS */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.listTreinamentos
);

/* BUSCAR TREINAMENTO POR ID */
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.getTreinamento
);

/* PRESIGN UPLOAD ATA */
router.post(
  "/:id/presign-ata",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.presignUploadAta
);

/* PRESIGN DOWNLOAD ATA */
router.get(
  "/:id/presign-download",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.presignDownloadAta
);

/* ATUALIZAR PARTICIPANTES */
router.put(
  "/:id/participantes",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.atualizarParticipantes
);

/* UPLOAD ATA + FINALIZAR (multipart — backend faz PUT ao R2) */
router.post(
  "/:id/upload-ata",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  upload.single("ata"),
  treinamentoController.uploadAta
);

/* FINALIZAR TREINAMENTO (legado — mantido para compatibilidade) */
router.post(
  "/:id/finalizar",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.finalizarTreinamento
);

/* CANCELAR TREINAMENTO */
router.post(
  "/:id/cancelar",
  authenticate,
  authorize("ADMIN", "ALTA_GESTAO", "LIDERANCA"),
  treinamentoController.cancelarTreinamento
);

module.exports = router;
