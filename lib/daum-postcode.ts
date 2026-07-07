export type DaumPostcodeResult = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
};

type DaumPostcodeConstructor = new (options: {
  oncomplete: (data: {
    zonecode: string;
    roadAddress: string;
    jibunAddress: string;
    buildingName: string;
    userSelectedType: "R" | "J";
  }) => void;
}) => {
  open: () => void;
};

declare global {
  interface Window {
    daum?: {
      Postcode: DaumPostcodeConstructor;
    };
  }
}

const DAUM_POSTCODE_SCRIPT =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

let scriptPromise: Promise<void> | null = null;

export function loadDaumPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("주소 검색은 브라우저에서만 사용할 수 있습니다."));
  }

  if (window.daum?.Postcode) {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${DAUM_POSTCODE_SCRIPT}"]`,
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("주소 검색 스크립트를 불러오지 못했습니다.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = DAUM_POSTCODE_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export function formatDaumAddress(data: DaumPostcodeResult): string {
  const base = data.roadAddress || data.jibunAddress;

  if (data.buildingName) {
    return `${base} (${data.buildingName})`;
  }

  return base;
}

export async function openDaumPostcode(
  onComplete: (data: DaumPostcodeResult) => void,
): Promise<void> {
  await loadDaumPostcodeScript();

  if (!window.daum?.Postcode) {
    throw new Error("주소 검색을 시작할 수 없습니다.");
  }

  new window.daum.Postcode({
    oncomplete: (data) => {
      onComplete({
        zonecode: data.zonecode,
        roadAddress: data.roadAddress,
        jibunAddress: data.jibunAddress,
        buildingName: data.buildingName,
      });
    },
  }).open();
}
