"use client";

import { useEffect, useRef, useState } from "react";
import ContractNoticeDocument from "./ContractNoticeDocument";

// 배송·교환·반품 안내문을 항상 같은 폭·글꼴로 그리고, 화면이 좁으면 통째로 축소한다.
// 기기와 상관없이 줄바꿈이 같아야 작성 때 그은 펜 표시(선 좌표)가 원문 위 같은 자리에 다시 겹친다.

export const NOTICE_SHEET_WIDTH = 860; // PDF 렌더 폭(PDF_RENDER_WIDTH_PX)과 같다

export type NoticeTool = "pen" | "highlighter";
export type NoticeStroke = { tool: NoticeTool; points: [number, number][] };
export type NoticeAnnotation = { strokes: NoticeStroke[] };

const TOOL_STYLES: Record<NoticeTool, { color: string; width: number }> = {
  pen: { color: "#e11d48", width: 2.5 },
  highlighter: { color: "rgba(255, 214, 0, 0.4)", width: 16 },
};

// 캔버스를 안내문(축소 전 크기)에 맞추고 획을 다시 그린다
export function drawNoticeStrokes(canvas: HTMLCanvasElement, strokes: NoticeStroke[]): void {
  const paper = canvas.parentElement;
  const context = canvas.getContext("2d");
  if (!paper || !context) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = paper.offsetWidth * ratio;
  const height = paper.offsetHeight * ratio;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, paper.offsetWidth, paper.offsetHeight);

  // 형광펜이 겹치는 구간마다 진해지지 않도록 획 하나를 한 번에 그린다
  for (const stroke of strokes) {
    const style = TOOL_STYLES[stroke.tool];
    context.strokeStyle = style.color;
    context.lineWidth = style.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    stroke.points.forEach(([x, y], index) => {
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  }
}

type NoticeSheetProps = {
  // 안내문 아래에 함께 보여줄 영역(동의 체크 문구)
  extra?: React.ReactNode;
  // 안내문 위에 겹치는 레이어(필기 캔버스)
  overlay?: React.ReactNode;
};

export default function NoticeSheet({ extra, overlay }: NoticeSheetProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>();

  useEffect(() => {
    const outer = outerRef.current;
    const paper = paperRef.current;
    if (!outer || !paper) {
      return;
    }

    function fit() {
      if (!outer || !paper) {
        return;
      }

      const nextScale = Math.min(1, outer.clientWidth / NOTICE_SHEET_WIDTH);
      setScale(nextScale);
      setHeight(paper.offsetHeight * nextScale);
    }

    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(paper);
    fit();

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="notice-sheet" style={{ height }}>
      <div
        ref={paperRef}
        className="notice-sheet__paper"
        style={{ width: NOTICE_SHEET_WIDTH, transform: `scale(${scale})` }}
      >
        <ContractNoticeDocument className="contract-doc contract-doc--document notice-document notice-sheet__document" />
        {extra ? <div className="notice-sheet__extra">{extra}</div> : null}
        {overlay}
      </div>
    </div>
  );
}

// 저장된 펜 표시를 원문 위에 겹쳐 그리는 읽기 전용 레이어
export function NoticeStrokesLayer({ strokes }: { strokes: NoticeStroke[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const paper = canvas?.parentElement;
    if (!canvas || !paper) {
      return;
    }

    // 웹폰트가 늦게 적용되면 안내문 높이가 바뀌므로 크기 변화마다 다시 그린다
    const observer = new ResizeObserver(() => drawNoticeStrokes(canvas, strokes));
    observer.observe(paper);
    drawNoticeStrokes(canvas, strokes);

    return () => observer.disconnect();
  }, [strokes]);

  return <canvas ref={canvasRef} className="notice-sheet__overlay notice-sheet__overlay--readonly" aria-hidden="true" />;
}

// 제출된 계약서 보기(웹 보기·PDF): 원문 + 동의 문구 + 작성 때 펜 표시.
// 펜 표시가 없으면 고정 폭으로 축소할 필요가 없으므로, 화면 폭에 맞게 줄바꿈되는 일반 안내문을 쓴다(휴대폰에서 글자가 작아지지 않게)
export function ContractNoticeSheet({
  values,
  className = "contract-doc contract-doc--document contract-doc--sheet notice-document",
}: {
  values: { noticeAnnotation?: NoticeAnnotation };
  className?: string;
}) {
  if (!values.noticeAnnotation) {
    return <ContractNoticeDocument className={className} />;
  }

  return (
    <NoticeSheet
      extra={<NoticeAgreeLine />}
      overlay={
        values.noticeAnnotation ? (
          <NoticeStrokesLayer strokes={values.noticeAnnotation.strokes} />
        ) : null
      }
    />
  );
}

// 안내문 아래 동의 문구. onChange가 없으면(제출된 계약서 보기) 체크된 모습으로만 보여준다
export function NoticeAgreeLine({
  checked = true,
  onChange,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="notice-agree">
      <input
        type="checkbox"
        checked={checked}
        disabled={!onChange}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      위 배송·교환·반품 등 안내사항을 모두 확인하였습니다.
    </label>
  );
}
