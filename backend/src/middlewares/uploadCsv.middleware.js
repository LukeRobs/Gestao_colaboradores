const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage(); // ✅ Memory para buffer (não salva em disco)

const fileFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();
  const isXlsx =
    name.endsWith(".xlsx") &&
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isCsv =
    name.endsWith(".csv") &&
    (file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel");

  if (isXlsx || isCsv) {
    cb(null, true);
  } else {
    cb(new Error("Apenas arquivos CSV ou XLSX são permitidos"), false);
  }
};

const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
};

const upload = multer({
  storage,
  fileFilter,
  limits,
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Arquivo muito grande (máx. 10MB)",
      });
    }
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Erro no upload do arquivo",
    });
  }
  next();
};

module.exports = { upload, handleMulterError };