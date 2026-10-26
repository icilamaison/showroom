"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import NoticeSheet, {
  drawNoticeStrokes,
  NOTICE_SHEET_WIDTH,
  type NoticeAnnotation,
  type NoticeStroke,
  type NoticeTool,
} from "./NoticeSheet";

// 배송·교환·반품 안내문 위에 애플 펜슬로 밑줄·표시를 하는 필기 레이어.
// 펜(마우스 포함)으로만 그리고, 손가락 터치는 그대로 화면 스크롤로 둔다.
// 선 좌표는 축소 전 안내문(NOTICE_SHEET_WIDTH) 기준으로 저장해 웹 보기·PDF에서 원문 위에 다시 그린다.

const TAP_MAX_DISTANCE = 6; // 이보다 짧게 움직이면 필기가 아니라 탭(체크박스·링크 클릭)으로 본다

export type NoticeAnnotatorHandle = {
  // 필기가 없으면 null
  getAnnotation: () => NoticeAnnotation | null;
};

type NoticeAnnotatorProps = {
  // 안내문 아래에 함께 필기할 영역(동의 체크 문구)
  extra?: React.ReactNode;
};

const NoticeAnnotator = forwardRef<NoticeAnnotatorHandle, NoticeAnnotatorProps>(function NoticeAnnotator(
  { extra },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<NoticeStroke[]>([]);
  const drawingRef = useRef<NoticeStroke | null>(null);
  // 방금 필기를 끝냈으면 뒤따르는 click을 아래 요소로 넘기지 않는다
  const justDrewRef = useRef(false);
  const [tool, setTool] = useState<NoticeTool>("pen");
  const [strokeCount, setStrokeCount] = useState(0);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    drawNoticeStrokes(
      canvas,
      drawingRef.current ? [...strokesRef.current, drawingRef.current] : strokesRef.current,
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const paper = canvas?.parentElement;
    if (!canvas || !paper) {
      return;
    }

    // 애플 펜슬로 그을 때는 화면이 같이 스크롤되지 않게 막는다. 손가락 터치는 막지 않는다
    function blockStylusScroll(event: TouchEvent) {
      const isStylus = Array.from(event.touches).some(
        (touch) => (touch as Touch & { touchType?: string }).touchType === "stylus",
      );
      if (isStylus) {
        event.preventDefault();
      }
    }

    const observer = new ResizeObserver(redraw);
    observer.observe(paper);
    redraw();
    canvas.addEventListener("touchstart", blockStylusScroll, { passive: false });
    canvas.addEventListener("touchmove", blockStylusScroll, { passive: false });

    return () => {
      observer.disconnect();
      canvas.removeEventListener("touchstart", blockStylusScroll);
      canvas.removeEventListener("touchmove", blockStylusScroll);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getAnnotation() {
      return strokesRef.current.length ? { strokes: strokesRef.current } : null;
    },
  }));

  // 안내문이 축소돼 있으므로 화면 좌표를 축소 전 좌표로 바꾼다(소수 첫째 자리까지만 저장)
  function toPaperPoint(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = rect.width / NOTICE_SHEET_WIDTH;
    return [
      Math.round(((event.clientX - rect.left) / scale) * 10) / 10,
      Math.round(((event.clientY - rect.top) / scale) * 10) / 10,
    ];
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = { tool, points: [toPaperPoint(event)] };
    redraw();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current.points.push(toPaperPoint(event));
    redraw();
  }

  function handlePointerUp() {
    const stroke = drawingRef.current;
    if (!stroke) {
      return;
    }

    drawingRef.current = null;
    const [startX, startY] = stroke.points[0];
    const isStroke = stroke.points.some(
      ([x, y]) => Math.hypot(x - startX, y - startY) > TAP_MAX_DISTANCE,
    );

    if (isStroke) {
      strokesRef.current = [...strokesRef.current, stroke];
      setStrokeCount(strokesRef.current.length);
      justDrewRef.current = true;
    }
    redraw();
  }

  // 캔버스가 위를 덮고 있어 체크박스·링크를 누를 수 없으므로, 탭(손가락·펜·마우스)은 아래 요소로 넘긴다
  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (justDrewRef.current) {
      justDrewRef.current = false;
      return;
    }

    const canvas = event.currentTarget;
    canvas.style.pointerEvents = "none";
    const target = document.elementFromPoint(event.clientX, event.clientY);
    canvas.style.pointerEvents = "";
    if (target instanceof HTMLElement) {
      target.click();
    }
  }

  function handleUndo() {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redraw();
  }

  function handleClear() {
    strokesRef.current = [];
    setStrokeCount(0);
    redraw();
  }

  return (
    <div className="notice-annotator">
      <div className="notice-annotator__tools">
        <span className="notice-annotator__label">펜으로 표시</span>
        <button
          type="button"
          className={`notice-annotator__tool notice-annotator__tool--pen${tool === "pen" ? " on" : ""}`}
          onClick={() => setTool("pen")}
        >
          빨간 펜
        </button>
        <button
          type="button"
          className={`notice-annotator__tool notice-annotator__tool--highlighter${tool === "highlighter" ? " on" : ""}`}
          onClick={() => setTool("highlighter")}
        >
          형광펜
        </button>
        <button
          type="button"
          className="notice-annotator__tool"
          disabled={strokeCount === 0}
          onClick={handleUndo}
        >
          되돌리기
        </button>
        <button
          type="button"
          className="notice-annotator__tool"
          disabled={strokeCount === 0}
          onClick={handleClear}
        >
          모두 지우기
        </button>
      </div>

      <NoticeSheet
        extra={extra}
        overlay={
          <canvas
            ref={canvasRef}
            className="notice-sheet__overlay"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleClick}
          />
        }
      />
    </div>
  );
});

export default NoticeAnnotator;
