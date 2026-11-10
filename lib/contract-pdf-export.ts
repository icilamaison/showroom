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
const CAPTURE_SCALE = 2;
// PNG 무압축이면 3쪽에 25MB가 넘는다. JPEG로 넣어 글씨는 선명하게 유지하면서 용량을 줄인다
const PAGE_IMAGE_QUALITY = 0.92;
// 페이지를 나눌 수 있는 경계(이 요소들의 아래쪽). 글줄·표 행이 반으로 잘리지 않게 한다
const PAGE_BREAK_SELECTOR = [
  "section",
  "header",
  "footer",
  "tr",
  "p",
  "li",
  "h2",
  ".contract-doc__agreement-box",
  ".contract-doc__agreement-text",
  ".contract-doc__agreement-sign",
  ".contract-doc-flow__actions",
  ".contract-doc__consent",
].join(", ");
// 이 요소는 항상 새 페이지에서 시작한다(동의 문구·서명). 러그 확인 박스는 계약서 본문이라 제외
const FORCE_PAGE_BREAK_SELECTOR =
  ".contract-doc__agreement-box:not(.contract-doc__agreement-box--rug)";
// 경계가 이보다 위에 있으면 페이지가 너무 비므로 그냥 잘라서 넘긴다
const MIN_PAGE_FILL_RATIO = 0.45;
// 살짝 넘쳐도 축소하지 않고 다음 장으로 보낸다(동의 문구 등). 웹과 같은 비율 유지
const FIT_ONE_PAGE_MAX_RATIO = 1;

type CapturedElement = {
  canvas: HTMLCanvasElement;
  // 캔버스 픽셀 기준, 페이지를 나눠도 되는 y 위치(오름차순)
  breakPoints: number[];
  // 캔버스 픽셀 기준, 반드시 페이지를 넘겨야 하는 y 위치
  forcedBreakPoints: number[];
};

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function appendCanvasToPdf(
  pdf: jsPDF,
  { canvas, breakPoints, forcedBreakPoints }: CapturedElement,
): void {
  const contentWidth =
    A4_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM;
  const contentHeightPerPage =
    A4_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
  const scale = contentWidth / canvas.width;
  const pageHeightPx = contentHeightPerPage / scale;

  // 한 장을 아주 조금 넘는 경우만 축소. 그 외에는 다음 장으로 넘긴다
  if (
    FIT_ONE_PAGE_MAX_RATIO > 1 &&
    canvas.height > pageHeightPx &&
    canvas.height <= pageHeightPx * FIT_ONE_PAGE_MAX_RATIO
  ) {
    const fitScale = contentHeightPerPage / canvas.height;
    const fitWidth = canvas.width * fitScale;
    pdf.addImage(
      canvas.toDataURL("image/jpeg", PAGE_IMAGE_QUALITY),
      "JPEG",
      MARGIN_LEFT_MM + (contentWidth - fitWidth) / 2,
      MARGIN_TOP_MM,
      fitWidth,
      contentHeightPerPage,
    );
    return;
  }

  let sourceY = 0;
  let sliceIndex = 0;

  while (sourceY < canvas.height) {
    if (sliceIndex > 0) {
      pdf.addPage();
    }

    const pageEnd = sourceY + pageHeightPx;
    const forcedBreakPoint = forcedBreakPoints.find(
      (point) => point > sourceY && point < Math.min(pageEnd, canvas.height),
    );
    const breakPoint =
      forcedBreakPoint ??
      (pageEnd >= canvas.height
        ? canvas.height
        : breakPoints.filter(
            (point) => point <= pageEnd && point >= sourceY + pageHeightPx * MIN_PAGE_FILL_RATIO,
          ).pop() ?? pageEnd);
    const sliceHeightPx = Math.min(breakPoint, canvas.height) - sourceY;
    const sliceHeightMm = sliceHeightPx * scale;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const context = pageCanvas.getContext("2d");
    if (!context) {
      break;
    }

    // JPEG는 투명 영역이 검게 나오므로 흰 바탕을 먼저 칠한다
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
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
      pageCanvas.toDataURL("image/jpeg", PAGE_IMAGE_QUALITY),
      "JPEG",
      MARGIN_LEFT_MM,
      MARGIN_TOP_MM,
      contentWidth,
      sliceHeightMm,
    );

    sourceY += sliceHeightPx;
    sliceIndex += 1;
  }
}

async function captureElement(element: HTMLElement): Promise<CapturedElement> {
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
    // 캡처와 같은 폭으로 그려진 상태에서 경계 위치를 잰다
    const top = element.getBoundingClientRect().top;
    const breakPoints = Array.from(
      new Set(
        [
          ...Array.from(element.querySelectorAll(PAGE_BREAK_SELECTOR)).flatMap(
            (node) => {
              const rect = node.getBoundingClientRect();
              return [
                Math.round((rect.bottom - top) * CAPTURE_SCALE),
              ];
            },
          ),
          // 동의·서명은 중간에 잘리지 않게 블록 시작에서도 자를 수 있게 한다
          ...Array.from(
            element.querySelectorAll(
              ".contract-doc-flow__actions, .contract-doc__agreement-box",
            ),
          ).map((node) =>
            Math.round((node.getBoundingClientRect().top - top) * CAPTURE_SCALE),
          ),
        ].filter((point) => point > 0),
      ),
    ).sort((a, b) => a - b);
    const forcedBreakPoints = Array.from(
      element.querySelectorAll(FORCE_PAGE_BREAK_SELECTOR),
    )
      .map((node) => Math.round((node.getBoundingClientRect().top - top) * CAPTURE_SCALE))
      .sort((a, b) => a - b);

    const canvas = await html2canvas(element, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    return { canvas, breakPoints, forcedBreakPoints };
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
    compress: true,
  });

  if (noticeElement && contractElement) {
    // 작성 화면 순서: 계약서 → 안내문 + 동의·서명
    appendCanvasToPdf(pdf, await captureElement(contractElement));
    pdf.addPage();
    appendCanvasToPdf(pdf, await captureElement(noticeElement));
  } else {
    appendCanvasToPdf(pdf, await captureElement(element));
  }

  pdf.save(filename);
}
