"use client";

import { useEffect, useRef, useState } from "react";

// 쇼룸에서 가구·배치·사이즈를 바로 그려 보는 임시 그림 메모.
// 계약서에는 저장하지 않고, 작성 화면을 열어 둔 동안만 유지한다.

const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 640;

const PEN_COLORS = [
  { id: "black", label: "검정", value: "#111827" },
  { id: "red", label: "빨강", value: "#dc2626" },
] as const;

type Tool = "pen" | "eraser";
type PenColor = (typeof PEN_COLORS)[number]["value"];

type LayoutSketchModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function LayoutSketchModal({ open, onClose }: LayoutSketchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  // 모달을 닫아도 같은 작성 세션에서는 그림을 다시 보여 준다
  const snapshotRef = useRef<string | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [penColor, setPenColor] = useState<PenColor>(PEN_COLORS[0].value);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!open) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(CANVAS_WIDTH * ratio);
    canvas.height = Math.floor(CANVAS_HEIGHT * ratio);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.aspectRatio = `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGrid(context);

    const snapshot = snapshotRef.current;
    if (!snapshot) {
      setHasInk(false);
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      setHasInk(true);
    };
    image.src = snapshot;
  }, [open]);

  function saveSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    snapshotRef.current = canvas.toDataURL("image/png");
  }

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getPoint(event);
    if (!canvas || !context || !point) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    applyTool(context);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    const point = getPoint(event);
    if (!context || !point) return;

    applyTool(context);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasInk(true);
  }

  function endDrawing() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    saveSnapshot();
  }

  function applyTool(context: CanvasRenderingContext2D) {
    if (tool === "eraser") {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "rgba(0,0,0,1)";
      context.lineWidth = 18;
      return;
    }

    context.globalCompositeOperation = "source-over";
    context.strokeStyle = penColor;
    context.lineWidth = 3;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawGrid(context);
    snapshotRef.current = null;
    setHasInk(false);
  }

  function selectPenColor(color: PenColor) {
    setPenColor(color);
    setTool("pen");
  }

  if (!open) return null;

  return (
    <div
      className="layout-sketch-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="그림 메모"
    >
      <div className="layout-sketch-modal">
        <div className="layout-sketch-modal__header">
          <p className="layout-sketch-modal__title">그림 메모</p>
          <div className="layout-sketch-modal__tools">
            <div className="layout-sketch-modal__colors" role="group" aria-label="펜 색상">
              {PEN_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`layout-sketch-modal__swatch${
                    tool === "pen" && penColor === color.value ? " is-on" : ""
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={color.label}
                  title={color.label}
                  onClick={() => selectPenColor(color.value)}
                />
              ))}
            </div>
            <button
              type="button"
              className={`layout-sketch-modal__tool${tool === "eraser" ? " is-on" : ""}`}
              onClick={() => setTool("eraser")}
            >
              지우개
            </button>
            <button
              type="button"
              className="layout-sketch-modal__tool"
              disabled={!hasInk}
              onClick={handleClear}
            >
              모두 지우기
            </button>
            <button
              type="button"
              className="layout-sketch-modal__tool layout-sketch-modal__tool--close"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>

        <div className="layout-sketch-modal__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="layout-sketch-modal__canvas"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={endDrawing}
            onPointerCancel={endDrawing}
            style={{ touchAction: "none" }}
            aria-label="그림 메모 판"
          />
        </div>
      </div>
    </div>
  );
}

function drawGrid(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "#eef2f7";
  context.lineWidth = 1;
  const step = 40;
  for (let x = step; x < CANVAS_WIDTH; x += step) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, CANVAS_HEIGHT);
    context.stroke();
  }
  for (let y = step; y < CANVAS_HEIGHT; y += step) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CANVAS_WIDTH, y);
    context.stroke();
  }
  context.restore();
}
