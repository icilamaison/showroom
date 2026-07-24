import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 16;
const MARGIN_BOTTOM_MM = 16;
const MARGIN_LEFT_MM = 18;
const MARGIN_RIGHT_MM = 18;
/** 화면 계약서 폭(--doc-width)과 동일하게 캡처 */
export const PDF_RENDER_WIDTH_PX = 860;

const PDF_NOTICE_SECTION_SELECTOR = ".contract-doc__pdf-notice-section";
const PDF_CONTRACT_SECTION_SELECTOR = ".contract-doc__pdf-contract-section";

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function appendCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  const contentWidth =
    A4_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM;
  const contentHeightPerPage =
    A4_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
  const scale = contentWidth / canvas.width;
  const pageHeightPx = contentHeightPerPage / scale;

  let sourceY = 0;
  let sliceIndex = 0;

  while (sourceY < canvas.height) {
    if (sliceIndex > 0) {
      pdf.addPage();
    }

    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - sourceY);
    const sliceHeightMm = sliceHeightPx * scale;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const context = pageCanvas.getContext("2d");
    if (!context) {
      break;
    }

    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    pdf.addImage(
      pageCanvas.toDataURL("image/png"),
      "PNG",
      MARGIN_LEFT_MM,
      MARGIN_TOP_MM,
      contentWidth,
      sliceHeightMm,
    );

    sourceY += sliceHeightPx;
    sliceIndex += 1;
  }
}

async function captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
  const collapsedDetails = Array.from(
    element.querySelectorAll("details:not([open])"),
  ) as HTMLDetailsElement[];
  collapsedDetails.forEach((details) => {
    details.open = true;
  });

  const previousWidth = element.style.width;
  const previousMaxWidth = element.style.maxWidth;
  element.style.width = `${PDF_RENDER_WIDTH_PX}px`;
  element.style.maxWidth = `${PDF_RENDER_WIDTH_PX}px`;
  await waitForNextFrame();

  try {
    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    element.style.width = previousWidth;
    element.style.maxWidth = previousMaxWidth;
    collapsedDetails.forEach((details) => {
      details.open = false;
    });
  }
}

export async function exportContractDocumentToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const noticeElement = element.querySelector(
    PDF_NOTICE_SECTION_SELECTOR,
  ) as HTMLElement | null;
  const contractElement = element.querySelector(
    PDF_CONTRACT_SECTION_SELECTOR,
  ) as HTMLElement | null;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  if (noticeElement && contractElement) {
    const noticeCanvas = await captureElement(noticeElement);
    appendCanvasToPdf(pdf, noticeCanvas);

    pdf.addPage();

    const contractCanvas = await captureElement(contractElement);
    appendCanvasToPdf(pdf, contractCanvas);
  } else {
    const canvas = await captureElement(element);
    appendCanvasToPdf(pdf, canvas);
  }

  pdf.save(filename);
}
