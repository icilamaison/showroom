"use client";

import html2canvas from "html2canvas";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ContractNoticeDocument from "./ContractNoticeDocument";

// 배송·교환·반품 안내문 위에 애플 펜슬로 밑줄·표시를 하는 필기 레이어.
// 펜(마우스 포함)으로만 그리고, 손가락 터치는 그대로 화면 스크롤로 둔다.
// 화면 폭·폰트에 따라 줄바꿈이 달라 필기 위치가 어긋나므로, 제출 시 안내문+필기를 한 장의 이미지로 저장한다.

type Tool = "pen" | "highlighter";
type Stroke = { tool: Tool; points: [number, number][] };

const TOOL_STYLES: Record<Tool, { color: string; width: number }> = {
  pen: { color: "#e11d48", width: 2.5 },
  highlighter: { color: "rgba(255, 214, 0, 0.4)", width: 16 },
};

const SNAPSHOT_SCALE = 1.5; // 글씨가 읽히는 최소 배율. 키우면 저장 용량이 커진다
const SNAPSHOT_QUALITY = 0.8;
const TAP_MAX_DISTANCE = 6; // 이보다 짧게 움직이면 필기가 아니라 탭(체크박스 클릭 등)으로 본다

export type NoticeAnnotatorHandle = {
  // 필기가 없으면 null(안내문 원본을 그대로 보여주면 된다)
  capture: () => Promise<string | null>;
};

type NoticeAnnotatorProps = {
  // 안내문 아래에 함께 필기할 영역(동의 체크 등). 필기 이미지에도 같이 찍힌다
  children?: React.ReactNode;
};

const NoticeAnnotator = forwardRef<NoticeAnnotatorHandle, NoticeAnnotatorProps>(function NoticeAnnotator(
  { children },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  // 방금 필기를 끝냈으면 뒤따르는 click을 아래 요소로 넘기지 않는다
  const justDrewRef = useRef(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [strokeCount, setStrokeCount] = useState(0);

  function redraw() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = drawingRef.current
      ? [...strokesRef.current, drawingRef.current]
      : strokesRef.current;

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

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) {
      return;
    }

    // 안내문 크기(화면 회전 포함)에 캔버스를 맞춘다
    function resize() {
      if (!wrap || !canvas) {
        return;
      }

      const ratio = window.devicePixelRatio || 1;
      canvas.width = wrap.offsetWidth * ratio;
      canvas.height = wrap.offsetHeight * ratio;
      redraw();
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

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    canvas.addEventListener("touchstart", blockStylusScroll, { passive: false });
    canvas.addEventListener("touchmove", blockStylusScroll, { passive: false });

    return () => {
      observer.disconnect();
      canvas.removeEventListener("touchstart", blockStylusScroll);
      canvas.removeEventListener("touchmove", blockStylusScroll);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async capture() {
      if (!wrapRef.current || strokesRef.current.length === 0) {
        return null;
      }

      const snapshot = await html2canvas(wrapRef.current, {
        scale: SNAPSHOT_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      return snapshot.toDataURL("image/jpeg", SNAPSHOT_QUALITY);
    },
  }));

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = {
      tool,
      points: [[event.nativeEvent.offsetX, event.nativeEvent.offsetY]],
    };
    redraw();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current.points.push([event.nativeEvent.offsetX, event.nativeEvent.offsetY]);
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

  // 캔버스가 위를 덮고 있어 체크박스를 누를 수 없으므로, 탭(손가락·펜·마우스)은 아래 요소로 넘긴다
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

      <div ref={wrapRef} className="notice-annotator__paper">
        <ContractNoticeDocument className="contract-doc contract-doc--document contract-doc--sheet notice-document" />
        {children ? <div className="notice-annotator__extra">{children}</div> : null}
        <canvas
          ref={canvasRef}
          className="notice-annotator__canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
        />
      </div>
    </div>
  );
});

export default NoticeAnnotator;
