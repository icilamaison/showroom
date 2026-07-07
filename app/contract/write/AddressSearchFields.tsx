"use client";

import { formatDaumAddress, openDaumPostcode } from "@/lib/daum-postcode";
import { useState } from "react";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="contract-doc__error">{message}</p>;
}

type AddressSearchFieldsProps = {
  postalCode: string;
  address: string;
  addressDetail: string;
  postalCodeError?: string;
  addressError?: string;
  addressDetailError?: string;
  onPostalCodeChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onAddressDetailChange: (value: string) => void;
};

export default function AddressSearchFields({
  postalCode,
  address,
  addressDetail,
  postalCodeError,
  addressError,
  addressDetailError,
  onPostalCodeChange,
  onAddressChange,
  onAddressDetailChange,
}: AddressSearchFieldsProps) {
  const [searchError, setSearchError] = useState("");

  async function handleSearch() {
    setSearchError("");

    try {
      await openDaumPostcode((data) => {
        onPostalCodeChange(data.zonecode);
        onAddressChange(formatDaumAddress(data));
        onAddressDetailChange("");
      });
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "주소 검색 중 오류가 발생했습니다.",
      );
    }
  }

  return (
    <>
      <tr>
        <th scope="row">배송지 주소</th>
        <td colSpan={3}>
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
              onClick={() => void handleSearch()}
            >
              주소 검색
            </button>
            <input
              type="text"
              value={address}
              readOnly
              className="contract-doc__cell-input contract-doc__cell-input--full contract-doc__cell-input--readonly"
              aria-label="기본주소"
            />
          </div>
          <FieldError message={postalCodeError} />
          <FieldError message={addressError} />
          <FieldError message={searchError} />
          <input
            type="text"
            value={addressDetail}
            onChange={(event) => onAddressDetailChange(event.target.value)}
            className="contract-doc__cell-input contract-doc__cell-input--full contract-doc__address-detail-input"
            placeholder="동·호수 등 상세주소가 있으면 입력해주세요"
            aria-label="상세주소"
          />
          <FieldError message={addressDetailError} />
        </td>
      </tr>
    </>
  );
}
