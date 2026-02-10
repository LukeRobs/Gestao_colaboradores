import domtoimage from "dom-to-image-more";
import jsPDF from "jspdf";

export async function exportOperationalReport({
  dados,
  turnoSelecionado,
  periodo,
}) {
  try {
    if (!dados) {
      console.warn("Export abortado: dados do dashboard não informados");
      return;
    }

    const element = document.getElementById("dashboard-operacional-export");

    if (!element) {
      console.error("Elemento do dashboard não encontrado");
      return;
    }

    /* =============================
       GERA IMAGEM DO DASHBOARD
    ============================== */
    const dataUrl = await domtoimage.toPng(element, {
      bgcolor: "#0D0D0D",
      quality: 1,
      filter: (node) => {
        // ignora elementos invisíveis
        if (node.style?.display === "none") return false;
        return true;
      },
    });

    /* =============================
       IMAGEM → PDF
    ============================== */
    const pdf = new jsPDF("p", "mm", "a4");

    const img = new Image();
    img.src = dataUrl;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (img.height * pdfWidth) / img.width;

    pdf.addImage(img, "PNG", 0, 0, pdfWidth, pdfHeight);

    const periodoLabel = periodo?.from
      ? periodo.to
        ? `${periodo.from.toLocaleDateString("pt-BR")}-${periodo.to.toLocaleDateString("pt-BR")}`
        : periodo.from.toLocaleDateString("pt-BR")
      : "dia-operacional";

    pdf.save(
      `dashboard-operacional_${turnoSelecionado}_${periodoLabel}.pdf`
    );
  } catch (err) {
    console.error("Erro ao exportar relatório:", err);
  }
}
