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
  const imageData = canvas.toDataURL("image/png");

  if (widthFittedHeight <= pageHeight) {
    // 한 장에 들어가면 A4 폭에 꽉 채워서 배치 (좌우 여백 없음)
    pdf.addImage(imageData, "PNG", 0, 0, pageWidth, widthFittedHeight);
  } else {
    // 한 장보다 길면 한 장에 맞게 통째로 축소 (내용 잘림 방지)
    const imageWidth = (canvas.width * pageHeight) / canvas.height;
    const imageX = (pageWidth - imageWidth) / 2;
    pdf.addImage(imageData, "PNG", imageX, 0, imageWidth, pageHeight);
  }

  pdf.save(filename);
}
