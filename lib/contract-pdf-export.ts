import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export async function exportContractDocumentToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = A4_WIDTH_MM;
  const pageHeight = A4_HEIGHT_MM;
  const widthFittedHeight = (canvas.height * pageWidth) / canvas.width;
  const imageHeight = Math.min(widthFittedHeight, pageHeight);
  const imageWidth =
    widthFittedHeight > pageHeight
      ? (canvas.width * pageHeight) / canvas.height
      : pageWidth;
  const imageX = (pageWidth - imageWidth) / 2;
  const imageData = canvas.toDataURL("image/png");

  pdf.addImage(imageData, "PNG", imageX, 0, imageWidth, imageHeight);

  pdf.save(filename);
}
