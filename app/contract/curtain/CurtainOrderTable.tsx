"use client";

import { useEffect, useState } from "react";
import { formatAmount, formatDigits, toDigits } from "@/lib/contract-amount";
import { formatDaumAddress, openDaumPostcode } from "@/lib/daum-postcode";
import "../contract.css";
import "./curtain.css";

const ITEM_COLUMN_COUNT = 6;

// 레일 단가표 — 시트 고정값. 레일커넥터는 단가 미정(비워둠).
const RAIL_OPTIONS: { label: string; price: number | null }[] = [
  { label: "6자", price: 13200 },
  { label: "8자", price: 16000 },
  { label: "10자", price: 18500 },
  { label: "12자", price: 21000 },
  { label: "14자", price: 23800 },
  { label: "16자", price: 26000 },
  { label: "크로스브라켓", price: 3000 },
  { label: "레일커넥터", price: null },
];

type CurtainItem = {
  productName: string;
  space: string;
  style: string;
  color: string;
  curtainSize: string;
  measuredWidth: string;
  measuredHeight: string;
  amount: string;
};

function createEmptyItem(): CurtainItem {
  return {
    productName: "",
    space: "",
    style: "",
    color: "",
    curtainSize: "",
    measuredWidth: "",
    measuredHeight: "",
    amount: "",
  };
}

// 확인사항 체크 — 2·3·4번은 택1이라 radio, 5번은 복수 선택이라 checkbox.
type ConfirmChecks = {
  makeSize: "" | "recommend" | "custom";
  makeSizeCm: string;
  layers: "" | "single" | "double";
  rail: "" | "none" | "self" | "request";
  railCount: string;
  highCeiling: boolean;
  noElevator: boolean;
};

function createEmptyChecks(): ConfirmChecks {
  return {
    makeSize: "",
    makeSizeCm: "",
    layers: "",
    rail: "",
    railCount: "",
    highCeiling: false,
    noElevator: false,
  };
}

// 오늘 날짜 (YYYY-MM-DD). 서버/클라이언트 시간대 차이로 인한
// hydration 불일치를 피하려고 마운트 후 채운다.
function todayValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const ITEM_FIELDS: { field: keyof CurtainItem; label: string }[] = [
  { field: "productName", label: "제품명" },
  { field: "space", label: "공간" },
  { field: "style", label: "스타일\n(민자/나비)" },
  { field: "color", label: "색상" },
  { field: "curtainSize", label: "커튼 호수" },
  { field: "measuredWidth", label: "실측 가로(cm)" },
  { field: "measuredHeight", label: "실측 세로(cm)" },
];

export default function CurtainOrderTable() {
  const [orderDate, setOrderDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressError, setAddressError] = useState("");
  const [sideNote, setSideNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundAccount, setRefundAccount] = useState("");
  const [refundHolder, setRefundHolder] = useState("");
  const [confirm, setConfirm] = useState<ConfirmChecks>(createEmptyChecks);
  const [items, setItems] = useState<CurtainItem[]>(() =>
    Array.from({ length: ITEM_COLUMN_COUNT }, createEmptyItem),
  );
  const [railQuantities, setRailQuantities] = useState<string[]>(() =>
    RAIL_OPTIONS.map(() => ""),
  );

  useEffect(() => {
    setOrderDate(todayValue());
  }, []);

  async function handleAddressSearch() {
    setAddressError("");

    try {
      await openDaumPostcode((data) => {
        setPostalCode(data.zonecode);
        setCustomerAddress(formatDaumAddress(data));
        setAddressDetail("");
      });
    } catch (error) {
      setAddressError(
        error instanceof Error
          ? error.message
          : "주소 검색 중 오류가 발생했습니다.",
      );
    }
  }

  function handleConfirmChange<K extends keyof ConfirmChecks>(
    key: K,
    value: ConfirmChecks[K],
  ) {
    setConfirm((prev) => ({ ...prev, [key]: value }));
  }

  function handleItemChange(
    index: number,
    field: keyof CurtainItem,
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function handleRailChange(index: number, value: string) {
    const digits = toDigits(value);
    setRailQuantities((prev) =>
      prev.map((quantity, i) => (i === index ? digits : quantity)),
    );
  }

  const itemTotal = items.reduce(
    (sum, item) => sum + Number(toDigits(item.amount) || 0),
    0,
  );
  const railTotal = RAIL_OPTIONS.reduce((sum, rail, index) => {
    const quantity = Number(railQuantities[index] || 0);
    return sum + (rail.price ?? 0) * quantity;
  }, 0);
  const grandTotal = itemTotal + railTotal;

  return (
    <div className="contract-doc contract-doc--document contract-doc--sheet curtain-doc">
      <header className="curtain-doc__header">
        <img
          className="curtain-doc__brand"
          src="https://icilamaison.com/26renewer/resource/image/logo_black.svg"
          alt="ICILAMAISON"
        />
        <label className="curtain-doc__date">
          DATE :
          <input
            type="date"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
            className="contract-doc__inline-input curtain-doc__date-input"
          />
        </label>
      </header>

      <div className="curtain-table-scroll">
      <table className="contract-doc__table curtain-table">
        <colgroup>
          <col className="curtain-table__col-label" />
          {RAIL_OPTIONS.map((rail) => (
            <col key={rail.label} className="curtain-table__col-item" />
          ))}
        </colgroup>

        <tbody>
          <tr>
            <th scope="row">성함</th>
            <td colSpan={4}>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
            <th scope="row">연락처</th>
            <td colSpan={3}>
              <input
                type="text"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
          </tr>

          <tr>
            <th scope="row">주소</th>
            <td colSpan={8}>
              <div className="contract-doc__address-search">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  readOnly
                  className="contract-doc__cell-input contract-doc__cell-input--postal"
                  aria-label="우편번호"
                />
                <button
                  type="button"
                  className="contract-doc__address-search-button"
                  onClick={() => void handleAddressSearch()}
                >
                  주소 검색
                </button>
                <input
                  type="text"
                  value={customerAddress}
                  readOnly
                  className="contract-doc__cell-input contract-doc__cell-input--full contract-doc__cell-input--readonly"
                  aria-label="기본주소"
                />
              </div>
              {addressError ? (
                <p className="contract-doc__error">{addressError}</p>
              ) : null}
              <input
                type="text"
                value={addressDetail}
                onChange={(event) => setAddressDetail(event.target.value)}
                className="contract-doc__cell-input contract-doc__cell-input--full contract-doc__address-detail-input"
                placeholder="동·호수 등 상세주소가 있으면 입력해주세요"
                aria-label="상세주소"
              />
            </td>
          </tr>

          {ITEM_FIELDS.map(({ field, label }, fieldIndex) => (
            <tr key={field}>
              <th scope="row" className="curtain-table__row-label">
                {label}
              </th>

              {items.map((item, index) => (
                <td key={index}>
                  {field === "style" ? (
                    <select
                      value={item.style}
                      onChange={(event) =>
                        handleItemChange(index, field, event.target.value)
                      }
                      className="contract-doc__cell-select"
                    >
                      <option value=""></option>
                      <option value="민자">민자</option>
                      <option value="나비">나비</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={item[field]}
                      onChange={(event) =>
                        handleItemChange(index, field, event.target.value)
                      }
                      className="contract-doc__cell-input"
                    />
                  )}
                </td>
              ))}

              {/* 항목 행 전체를 세로로 병합한 우측 여백 칸 */}
              {fieldIndex === 0 ? (
                <td rowSpan={ITEM_FIELDS.length + 1} colSpan={2}>
                  <textarea
                    value={sideNote}
                    onChange={(event) => setSideNote(event.target.value)}
                    className="contract-doc__cell-input curtain-table__side-note"
                  />
                </td>
              ) : null}
            </tr>
          ))}

          <tr>
            <th scope="row" className="curtain-table__row-label">
              금액
            </th>
            {items.map((item, index) => (
              <td key={index}>
                <input
                  type="text"
                  value={formatDigits(item.amount)}
                  onChange={(event) =>
                    handleItemChange(index, "amount", toDigits(event.target.value))
                  }
                  inputMode="numeric"
                  className="contract-doc__cell-input contract-doc__cell-input--numeric"
                />
              </td>
            ))}
          </tr>

          <tr>
            <th scope="row" rowSpan={2} className="curtain-table__row-label">
              레일
            </th>
            {RAIL_OPTIONS.map((rail) => (
              <td key={rail.label} className="curtain-table__rail-head">
                <span className="curtain-table__rail-name">{rail.label}</span>
                <span className="curtain-table__rail-price">
                  {rail.price === null ? "" : formatAmount(rail.price)}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            {RAIL_OPTIONS.map((rail, index) => (
              <td key={rail.label}>
                <input
                  type="text"
                  value={railQuantities[index]}
                  onChange={(event) => handleRailChange(index, event.target.value)}
                  inputMode="numeric"
                  className="contract-doc__cell-input contract-doc__cell-input--qty"
                />
              </td>
            ))}
          </tr>

          <tr>
            <td colSpan={9} className="curtain-table__total">
              총 결제 금액 : ₩ {formatAmount(grandTotal)}
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              확인사항
            </th>
            <td colSpan={8} className="curtain-table__notice">
              <p className="curtain-notice__lead">
                본 상품은 주문 제작 상품으로, 변심에 의한 교환·반품이 불가합니다.
              </p>

              <h3 className="curtain-notice__title">1. 해피콜 및 사이즈 확정</h3>
              <p className="curtain-notice__text">
                - 영업일 기준 3일 내 해피콜을 통해 최종 사이즈를 확정합니다.
                <br />- 사이즈 변경 시 최종 견적 금액이 변동될 수 있습니다.
                <br />- 사이즈 확정 후에는 변경 및 반품이 불가합니다.
              </p>

              <h3 className="curtain-notice__title">2. 제작 사이즈</h3>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="makeSize"
                  checked={confirm.makeSize === "recommend"}
                  onChange={() => handleConfirmChange("makeSize", "recommend")}
                />
                실측 사이즈에서 5cm 짧게 제작 (권장)
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="makeSize"
                  checked={confirm.makeSize === "custom"}
                  onChange={() => handleConfirmChange("makeSize", "custom")}
                />
                실측 사이즈에서
                <input
                  type="text"
                  value={confirm.makeSizeCm}
                  onChange={(event) =>
                    handleConfirmChange("makeSizeCm", toDigits(event.target.value))
                  }
                  inputMode="numeric"
                  className="contract-doc__inline-input curtain-notice__blank"
                />
                cm 짧게 제작
              </label>

              <h3 className="curtain-notice__title">3. 커튼 겹수 선택</h3>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="layers"
                  checked={confirm.layers === "single"}
                  onChange={() => handleConfirmChange("layers", "single")}
                />
                1중 커튼 (커튼 1종)
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="layers"
                  checked={confirm.layers === "double"}
                  onChange={() => handleConfirmChange("layers", "double")}
                />
                2중 커튼 (속커튼 + 겉커튼) — 커튼박스 폭 15cm 이상 필요
              </label>

              <h3 className="curtain-notice__title">4. 기존 레일 유무 및 철거</h3>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="rail"
                  checked={confirm.rail === "none"}
                  onChange={() => handleConfirmChange("rail", "none")}
                />
                기존 레일 없음
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="rail"
                  checked={confirm.rail === "self"}
                  onChange={() => handleConfirmChange("rail", "self")}
                />
                고객이 시공 전 직접 철거 완료
              </label>
              <label className="curtain-notice__check">
                <input
                  type="radio"
                  name="rail"
                  checked={confirm.rail === "request"}
                  onChange={() => handleConfirmChange("rail", "request")}
                />
                철거 서비스 요청 — 레일
                <input
                  type="text"
                  value={confirm.railCount}
                  onChange={(event) =>
                    handleConfirmChange("railCount", toDigits(event.target.value))
                  }
                  inputMode="numeric"
                  className="contract-doc__inline-input curtain-notice__blank"
                />
                개 (개당 10,000원)
              </label>

              <h3 className="curtain-notice__title">5. 특수 시공 환경 (해당 시 체크)</h3>
              <label className="curtain-notice__check">
                <input
                  type="checkbox"
                  checked={confirm.highCeiling}
                  onChange={(event) =>
                    handleConfirmChange("highCeiling", event.target.checked)
                  }
                />
                층고 4m 이상
              </label>
              <label className="curtain-notice__check">
                <input
                  type="checkbox"
                  checked={confirm.noElevator}
                  onChange={(event) =>
                    handleConfirmChange("noElevator", event.target.checked)
                  }
                />
                엘리베이터 없어 계단 자재 운반
              </label>
              <p className="curtain-notice__text">
                ※ 해당 항목 체크 시 사전 협의가 필요하며 추가 비용이 발생할 수 있습니다.
              </p>
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              비고
            </th>
            <td colSpan={8}>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                className="contract-doc__cell-input curtain-table__remarks"
              />
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              {"실측비\n환불 계좌"}
            </th>
            <th scope="col">은행</th>
            <td colSpan={2}>
              <input
                type="text"
                value={refundBank}
                onChange={(event) => setRefundBank(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
            <th scope="col">계좌번호</th>
            <td colSpan={2}>
              <input
                type="text"
                value={refundAccount}
                onChange={(event) => setRefundAccount(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
            <th scope="col">예금주</th>
            <td>
              <input
                type="text"
                value={refundHolder}
                onChange={(event) => setRefundHolder(event.target.value)}
                className="contract-doc__cell-input"
              />
            </td>
          </tr>

          <tr>
            <th scope="row" className="curtain-table__row-label">
              배송 안내
            </th>
            <td colSpan={8} className="curtain-table__delivery">
              쇼룸 구입 후 최대 3일 이내 해피콜 진행 / 해피콜 이후 1주 이내
              출고(주말,공휴일 제외) 됩니다.
              <br />
              주문량이 많거나 상품의 특성에 따라 발송 기간이 다소 지연될 수 있습니다.
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
