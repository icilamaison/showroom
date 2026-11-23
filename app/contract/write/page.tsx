"use client";

import {
  ApiClientError,
  fetchAdminContractById,
  submitContract,
  updateAdminContract,
} from "@/lib/api-client";
import { findCatalogProductByName, getSizeSalePrice, getTypeSalePrice, getVariantComponents, isSetProduct, searchProducts, SLIP_PAD_PRODUCT, withSizeSiblings, type CatalogProduct } from "@/lib/product-catalog";
import {
  buildSetSelectionsFromColor,
  createSetComponentSelections,
  formatSetOptionName,
  resolveComponentPriceForSize,
  type SetComponentSelection,
} from "@/lib/set-product";
import { getGiftColorOptions, getGiftQuantities, getGooseGiftQuantities, isGooseGiftName, syncGiftRows } from "@/lib/contract-gift";
import { formatPhoneInput, PHONE_FORM_FIELDS } from "@/lib/phone";
import type {
  ContractFormValues,
  ProductRow,
  ValidatedContractFormValues,
} from "@/lib/validation/contract";
import {
  createEmptyProductRow,
  createEmptyProductRows,
  getSize4DeliveryKinds,
  isGiftRow,
  isSize4DeliveryAnswered,
  PRODUCT_ROW_COUNT,
  validateContractForm,
} from "@/lib/validation/contract";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "../../ui.css";
import "../contract.css";
import ContractCompanyFooter from "../ContractCompanyFooter";
import NoticeAnnotator, { type NoticeAnnotatorHandle } from "../NoticeAnnotator";
import ContractForm, { ContractAgreementBox, createInitialContractFormValues } from "./ContractForm";

// 패드를 구매로 체크하고 수량을 넣으면 상품 표에 패드 행을 넣고(빈 행 우선), 미구매·수량 0이면 비운다.
// 패드는 기타 카테고리 상품이라 개별·전체 할인에서 빠진다(contract-amount 참고)
function syncSlipPadRow(values: ContractFormValues): ProductRow[] {
  if (!SLIP_PAD_PRODUCT) {
    return values.products;
  }

  const name = SLIP_PAD_PRODUCT.productName;
  const quantity = values.padPurchased ? (values.padQuantity ?? "") : "";
  const products = [...values.products];
  let index = products.findIndex((product) => product.name.trim() === name);

  if (!Number(quantity)) {
    if (index >= 0) {
      products[index] = createEmptyProductRow();
    }
    return products;
  }

  if (index < 0) {
    index = products.findIndex((product) => !product.name.trim());
  }
  if (index < 0) {
    products.push(createEmptyProductRow());
    index = products.length - 1;
  }

  products[index] = {
    ...products[index],
    name,
    quantity,
    unitPrice: products[index].unitPrice || String(SLIP_PAD_PRODUCT.salePrice),
  };
  return products;
}

// 미끄럼방지 패드 구매 여부는 계약서 작성 화면 전용 필수 항목이라
// 커튼 주문서와 같이 쓰는 스키마 대신 여기서 확인한다
function validatePadPurchase(values: ContractFormValues): Record<string, string> {
  if (typeof values.padPurchased !== "boolean") {
    return { padPurchased: "미끄럼방지 패드 구매 여부를 선택해주세요." };
  }
  if (values.padPurchased && !(Number(values.padQuantity) >= 1)) {
    return { padQuantity: "미끄럼방지 패드 수량을 입력해주세요." };
  }
  return {};
}

// 해당 금액의 사은품이 있으면 증정 여부를 꼭 고르게 한다(빠뜨림 방지). 수정 모드는 이전 계약서라 보지 않는다
function validateGiftChoice(values: ContractFormValues): Record<string, string> {
  const hasGifts = getGiftQuantities(values.products, values.totalDiscountRate).size > 0;
  if (hasGifts && typeof values.giftProvided !== "boolean") {
    return { giftProvided: "사은품 증정 여부를 선택해주세요." };
  }
  const hasGooseGifts = getGooseGiftQuantities(values.products).size > 0;
  if (hasGooseGifts && typeof values.gooseGiftProvided !== "boolean") {
    return { gooseGiftProvided: "이불커버 증정 여부를 선택해주세요." };
  }
  // 컬러를 고르는 사은품은 컬러가 없으면 플레이오토 출고 상품이 정해지지 않는다
  const needsColor = values.products.some(
    (product) => getGiftColorOptions(product.name, product.size).length > 0 && !product.color.trim(),
  );
  return needsColor ? { gooseGiftProvided: "사은품 컬러를 선택해주세요." } : {};
}

// 두 번째 페이지(안내 확인)에서 받는 동의·서명 항목
const AGREEMENT_FIELDS = [
  "termsAgreed",
  "marketingConsentAgreed",
  "agreementDate",
  "signatureName",
  "signatureDataUrl",
];

// 첫 페이지 검사용 임시값 (실제 값은 두 번째 페이지에서 받는다)
const AGREEMENT_PLACEHOLDER = {
  termsAgreed: true,
  signatureName: "구매자",
  signatureDataUrl: "pending",
};

// 작성 중 뒤로 가기·탭 이동(사파리가 백그라운드 탭을 새로고침)으로 입력값이 날아가지 않게 임시저장한다.
// 고객 개인정보라 탭을 닫으면 사라지는 sessionStorage에만 두고, 제출하면 지운다
const DRAFT_STORAGE_KEY = "contract-write-draft";

function readDraft(): ContractFormValues | null {
  try {
    const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as ContractFormValues) : null;
  } catch {
    return null; // 저장소 접근 불가·손상 시 새로 작성
  }
}

function writeDraft(values: ContractFormValues) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
  } catch {} // 저장 실패해도 작성은 계속
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}

// 작성 중 행 삭제는 행 번호가 밀리지 않게 내용만 비운다. 고객용 계약서 No가 건너뛰지 않도록
// 저장할 때 빈 행을 뒤로 모은다 (행 수는 그대로)
function moveEmptyRowsToEnd<T extends { name: string }>(products: T[]): T[] {
  return [
    ...products.filter((product) => product.name.trim()),
    ...products.filter((product) => !product.name.trim()),
  ];
}

// 저장된 상품 행으로 상품 드롭다운·세트 구성품 선택을 되돌린다 (수정 모드·임시저장 복원 공용)
function restoreProductSelections(products: ProductRow[]) {
  const selections: Record<number, CatalogProduct | null> = {};
  const setSelections: Record<number, SetComponentSelection[]> = {};
  products.forEach((product, index) => {
    const name = product.name.trim();
    if (!name) {
      return;
    }

    // 묶음 상품은 검색 결과에만 있고, 미진열 상품은 검색에서 빠지므로 이름 조회로 한 번 더 찾는다
    const catalogProduct =
      searchProducts(name, 50).find((candidate) => candidate.productName === name) ??
      findCatalogProductByName(name);
    if (!catalogProduct) {
      return;
    }

    selections[index] = withSizeSiblings(catalogProduct);
    if (isSetProduct(catalogProduct)) {
      setSelections[index] = buildSetSelectionsFromColor(
        catalogProduct.components ?? [],
        product.color,
      );
    }
  });
  return { selections, setSelections };
}

export default function ContractWritePage() {
  const router = useRouter();
  const [values, setValues] = useState<ContractFormValues>(
    createInitialContractFormValues,
  );
  const [productSelections, setProductSelections] = useState<
    Record<number, CatalogProduct | null>
  >({});
  const [setComponentSelections, setSetComponentSelections] = useState<
    Record<number, SetComponentSelection[]>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 계약서 작성 → 배송·교환·반품 안내 확인 + 동의·서명 → 제출 순서
  const [step, setStep] = useState<"form" | "notice">("form");
  const noticeAnnotatorRef = useRef<NoticeAnnotatorHandle>(null);
  // 관리자 상세의 "수정"으로 들어오면(?edit=계약서ID) 저장된 내용을 채우고, 저장 시 같은 계약서를 고친다
  const [editId, setEditId] = useState<number | null>(null);
  const [editContractNumber, setEditContractNumber] = useState("");
  // 첫 렌더의 빈 값으로 임시저장을 덮어쓰지 않도록 복원이 끝난 뒤부터 저장한다
  const [isDraftReady, setIsDraftReady] = useState(false);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    if (!Number.isInteger(id) || id <= 0) {
      // 새 작성: 임시저장이 있으면 이어서 작성
      const draft = readDraft();
      if (draft) {
        const { selections, setSelections } = restoreProductSelections(draft.products);
        setValues({ ...createInitialContractFormValues(), ...draft });
        setProductSelections(selections);
        setSetComponentSelections(setSelections);
      }
      setIsDraftReady(true);
      return;
    }

    fetchAdminContractById(id)
      .then((contract) => {
        const payload = contract.payload as Partial<ContractFormValues>;
        const products = [...(payload.products ?? [])];
        while (products.length < PRODUCT_ROW_COUNT) {
          products.push(createEmptyProductRow());
        }

        // 상품 드롭다운·세트 구성품 선택도 저장된 값으로 되돌린다
        const { selections, setSelections } = restoreProductSelections(products);

        setValues({ ...createInitialContractFormValues(), ...payload, products });
        setProductSelections(selections);
        setSetComponentSelections(setSelections);
        setEditId(id);
        setEditContractNumber(contract.contractNumber);
      })
      .catch((error) => {
        if (error instanceof ApiClientError && error.status === 401) {
          router.push("/admin/login");
          return;
        }

        setFormError("수정할 계약서를 불러오지 못했습니다.");
      });
  }, [router]);

  // 수정 모드는 서버에 저장된 계약서를 고치는 것이라 임시저장하지 않는다
  useEffect(() => {
    if (isDraftReady) {
      writeDraft(values);
    }
  }, [isDraftReady, values]);

  // 사은품 증정 여부·상품·할인율이 바뀌면 사은품 행을 맞춘다.
  // 증정 여부를 고르기 전(기능 이전 계약서 포함)에는 상품 표를 건드리지 않는다
  useEffect(() => {
    setValues((current) => {
      if (typeof current.giftProvided !== "boolean" && typeof current.gooseGiftProvided !== "boolean") {
        return current;
      }
      // 구스 이불솜이 빠지면 이불커버 줄이 숨는다. 선택이 남으면 다시 담을 때 커버가 바로 들어가므로 푼다
      // (커버 행은 아래 동기화에서 이불솜이 없으니 빠진다)
      if (current.gooseGiftProvided != null && getGooseGiftQuantities(current.products).size === 0) {
        current = { ...current, gooseGiftProvided: null };
      }
      const products = syncGiftRows(
        current.products,
        current.totalDiscountRate,
        current.giftProvided === true,
        current.gooseGiftProvided === true,
      );
      return products === current.products ? current : { ...current, products };
    });
  }, [values.giftProvided, values.gooseGiftProvided, values.products, values.totalDiscountRate]);

  function clearFieldError(field: string) {
    if (!errors[field]) {
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleChange(
    field: keyof ContractFormValues,
    value: string | boolean | null | Record<string, string>,
  ) {
    const nextValue =
      typeof value === "string" && PHONE_FORM_FIELDS.has(field)
        ? formatPhoneInput(value)
        : value;

    setValues((current) => {
      const next = { ...current, [field]: nextValue };

      if (field === "recipientSameAsBuyer" && value === true) {
        next.recipientName = "";
        next.recipientPhone = "";
      }

      if (field === "paymentMethod" && value === "card") {
        next.cashReceiptType = "";
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
        next.taxInvoiceRequested = false;
        next.taxInvoiceEmail = "";
      }

      if (field === "cashReceiptType" && value) {
        next.taxInvoiceRequested = false;
        next.taxInvoiceEmail = "";
      }

      if (field === "cashReceiptType" && !value) {
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
      }

      if (field === "taxInvoiceRequested" && value === true) {
        next.cashReceiptType = "";
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
      }

      if (
        field === "writtenDateYear" ||
        field === "writtenDateMonth" ||
        field === "writtenDateDay"
      ) {
        next.agreementDateYear = next.writtenDateYear;
        next.agreementDateMonth = next.writtenDateMonth;
        next.agreementDateDay = next.writtenDateDay;
      }

      if (field === "buyerName" && typeof nextValue === "string") {
        next.signatureName = nextValue;
      }

      if (field === "padPurchased" || field === "padQuantity") {
        next.products = syncSlipPadRow(next);
      }

      return next;
    });

    clearFieldError(field);

    if (
      field === "writtenDateYear" ||
      field === "writtenDateMonth" ||
      field === "writtenDateDay"
    ) {
      clearFieldError("agreementDateYear");
      clearFieldError("agreementDateMonth");
      clearFieldError("agreementDateDay");
    }

    if (field === "buyerName") {
      clearFieldError("signatureName");
    }

    if (field === "padPurchased") {
      clearFieldError("padQuantity");
    }
  }

  function handleProductChange(
    index: number,
    field: keyof ProductRow,
    value: string,
  ) {
    if (field === "name") {
      setProductSelections((current) => {
        if (!current[index]) {
          return current;
        }

        const next = { ...current };
        delete next[index];
        return next;
      });
      setSetComponentSelections((current) => {
        if (!current[index]) {
          return current;
        }

        const next = { ...current };
        delete next[index];
        return next;
      });
    }

    setValues((current) => ({
      ...current,
      // 상품 표에서 패드 행 수량을 바꾸면 아래 미끄럼방지 패드 수량도 맞춘다(반대 방향은 syncSlipPadRow)
      ...(field === "quantity" &&
      SLIP_PAD_PRODUCT &&
      current.products[index]?.name.trim() === SLIP_PAD_PRODUCT.productName
        ? { padQuantity: value }
        : {}),
      products: current.products.map((product, productIndex) => {
        if (productIndex !== index) {
          return product;
        }

        if (field === "name") {
          return {
            ...product,
            name: value,
            type: "",
            color: "",
            size: "",
            remarks: "",
          };
        }

        // 사은품 행은 사이즈로 이불커버 행을 구분한다. 아래처럼 사이즈를 비우면 사은품 동기화가 행을 새로 만들어 컬러가 날아간다
        if (field === "color" && isGiftRow(product)) {
          return { ...product, color: value };
        }

        if (field === "color") {
          const selected = productSelections[index];
          // 사이즈·컬러 형제를 묶은 상품은 색상과 사이즈가 독립이라, 색상을 바꿔도 고른 사이즈·가격을 유지한다
          const keepSize = Boolean(
            (selected?.soldOutColorsBySize || selected?.soldOutSizesByColor) &&
              product.size,
          );
          const salePrice = selected
            ? getTypeSalePrice(selected, keepSize ? product.size : "", product.type) ??
              getSizeSalePrice(selected, keepSize ? product.size : value, value) ??
              selected.salePrice
            : null;
          const components = selected ? getVariantComponents(selected, value) : [];

          if (components.length) {
            setSetComponentSelections((current) => ({
              ...current,
              [index]: createSetComponentSelections(components),
            }));
          } else {
            setSetComponentSelections((current) => {
              if (!current[index]) {
                return current;
              }

              const next = { ...current };
              delete next[index];
              return next;
            });
          }

          return {
            ...product,
            color: value,
            size: keepSize ? product.size : "",
            ...(salePrice != null ? { unitPrice: String(salePrice) } : {}),
          };
        }

        if (field === "size") {
          const selected = productSelections[index];
          const salePrice = selected
            ? getTypeSalePrice(selected, value, product.type) ??
              getSizeSalePrice(selected, value, product.color) ??
              selected.salePrice
            : null;
          const components = selected ? getVariantComponents(selected, value) : [];

          if (components.length) {
            setSetComponentSelections((current) => ({
              ...current,
              [index]: createSetComponentSelections(components),
            }));
          }

          return {
            ...product,
            size: value,
            ...(salePrice != null ? { unitPrice: String(salePrice) } : {}),
          };
        }

        if (field === "type") {
          const selected = productSelections[index];
          // TYPE 가격이 없는 상품은 기존 단가(수기 입력 포함)를 건드리지 않는다
          if (!selected?.typePrices && !selected?.sizes?.some((size) => typeof size !== "string" && size.typePrices)) {
            return { ...product, type: value };
          }

          const salePrice =
            getTypeSalePrice(selected, product.size, value) ??
            getSizeSalePrice(selected, product.size || product.color, product.color) ??
            selected.salePrice;

          return { ...product, type: value, unitPrice: String(salePrice) };
        }

        return { ...product, [field]: value };
      }),
    }));

    clearFieldError("products");
    clearFieldError(`products.${index}.${field}`);
  }

  function handleSetComponentChange(
    index: number,
    componentIndex: number,
    field: keyof SetComponentSelection,
    value: string,
  ) {
    const selectedProduct = productSelections[index];
    const row = values.products[index];
    const variantName = row?.color || row?.size || "";
    const components = selectedProduct
      ? getVariantComponents(selectedProduct, variantName)
      : [];

    if (!components.length) {
      return;
    }
    const nextSelections = [
      ...(setComponentSelections[index] ??
        createSetComponentSelections(components)),
    ];
    nextSelections[componentIndex] = {
      ...nextSelections[componentIndex],
      [field]: value,
      // 컬러별로 가격이 다른 구성품(예: 인견 패드 K)도 있어 컬러 변경 시에도 재계산
      ...(field === "size" || field === "color"
        ? { unitPrice: resolveComponentPriceForSize(components[componentIndex], value) }
        : {}),
    };

    setSetComponentSelections((current) => ({
      ...current,
      [index]: nextSelections,
    }));

    // 구성품 옵션 가격이 다르면(인견 패드 베이지 -10,240원) 카페24처럼 세트가도 다시 계산한다
    const discountRate = selectedProduct?.setDiscountRate;
    const canRecalculate =
      discountRate != null && nextSelections.every((selection) => selection.unitPrice);
    const setPrice = canRecalculate
      ? Math.floor(
          (nextSelections.reduce(
            (sum, selection) =>
              sum + Number(selection.unitPrice) * Number(selection.quantity || 1),
            0,
          ) *
            (100 - discountRate)) /
            100 /
            10,
        ) * 10
      : null;

    setValues((current) => ({
      ...current,
      products: current.products.map((row, productIndex) =>
        productIndex === index
          ? {
              ...row,
              color: selectedProduct?.components?.length
                ? formatSetOptionName(components, nextSelections)
                : row.color,
              ...(setPrice != null ? { unitPrice: String(setPrice) } : {}),
            }
          : row,
      ),
    }));
  }

  function handleProductSelect(index: number, product: CatalogProduct) {
    setProductSelections((current) => ({
      ...current,
      [index]: withSizeSiblings(product),
    }));

    const isSet = isSetProduct(product);
    const componentSelections = isSet
      ? createSetComponentSelections(product.components ?? [])
      : [];

    if (isSet) {
      setSetComponentSelections((current) => ({
        ...current,
        [index]: componentSelections,
      }));
    } else {
      setSetComponentSelections((current) => {
        if (!current[index]) {
          return current;
        }

        const next = { ...current };
        delete next[index];
        return next;
      });
    }

    setValues((current) => ({
      ...current,
      products: current.products.map((row, productIndex) =>
        productIndex === index
          ? {
              ...row,
              name: product.productName,
              type: "",
              color: isSet
                ? formatSetOptionName(
                    product.components ?? [],
                    componentSelections,
                  )
                : "",
              size: "",
              quantity: row.quantity || "1",
              unitPrice: String(product.salePrice),
              remarks: "",
            }
          : row,
      ),
    }));

    clearFieldError("products");
    clearFieldError(`products.${index}.name`);
    clearFieldError(`products.${index}.unitPrice`);
  }

  function handleAddProductRow() {
    setValues((current) => ({
      ...current,
      products: [...current.products, createEmptyProductRow()],
    }));
  }

  function handleClearProductRow(index: number) {
    if (!window.confirm(`${index + 1}번 행을 삭제할까요?`)) {
      return;
    }

    setValues((current) => {
      const isPadRow =
        SLIP_PAD_PRODUCT &&
        current.products[index]?.name.trim() === SLIP_PAD_PRODUCT.productName;
      // 사은품 행을 지우면 그 증정 선택을 풀고 같은 종류 사은품 행을 모두 뺀다. 두면 동기화가 바로 다시 넣는다
      // (금액별 사은품과 이불커버는 따로 고른다)
      const target = current.products[index];
      const isGift = target ? isGiftRow(target) : false;
      const isGooseGift = isGift && isGooseGiftName(target.name);
      const isSameGift = (product: ProductRow) =>
        isGift && isGiftRow(product) && isGooseGiftName(product.name) === isGooseGift;

      return {
        ...current,
        // 패드 행을 지우면 아래 패드 구매 여부를 다시 고르게 한다
        ...(isPadRow ? { padPurchased: null, padQuantity: "" } : {}),
        ...(isGift ? (isGooseGift ? { gooseGiftProvided: null } : { giftProvided: null }) : {}),
        products: current.products.map((product, productIndex) =>
          productIndex === index || isSameGift(product) ? createEmptyProductRow() : product,
        ),
      };
    });

    setProductSelections((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
    setSetComponentSelections((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => !field.startsWith(`products.${index}.`)),
      ),
    );
  }

  function handleClearAllProductRows() {
    if (!window.confirm("상품을 모두 삭제할까요?")) return;

    setValues((current) => {
      const padName = SLIP_PAD_PRODUCT?.productName;
      const hasPadRow = padName && current.products.some((product) => product.name.trim() === padName);

      return {
        ...current,
        // 패드 행을 지우면 아래 패드 구매 여부를 다시 고르게 한다
        ...(hasPadRow ? { padPurchased: null, padQuantity: "" } : {}),
        // 다음 상품 입력 때 사은품이 바로 들어가지 않게 증정 여부도 다시 고르게 한다
        giftProvided: null,
        gooseGiftProvided: null,
        products: createEmptyProductRows(),
      };
    });
    setProductSelections({});
    setSetComponentSelections({});
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith("products."))),
    );
  }

  function handleRemoveLastProductRow() {
    setValues((current) => {
      if (current.products.length <= PRODUCT_ROW_COUNT) {
        return current;
      }

      return {
        ...current,
        products: current.products.slice(0, -1),
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    // 새 작성은 동의·서명이 아직 비어 있다. 그대로 검사하면 기본 검사에서 멈춰
    // 러그 동의 같은 세부 검사(superRefine)가 돌지 않으므로 임시값을 채워 검사한다
    const validation = validateContractForm(
      editId ? values : { ...values, ...AGREEMENT_PLACEHOLDER },
    );
    const padErrors = {
      ...validatePadPurchase(values),
      ...(editId ? {} : validateGiftChoice(values)),
    };
    const formErrors = validation.valid ? {} : validation.errors;

    // 새 작성은 동의·서명을 두 번째 페이지에서 받으므로 여기서는 그 항목 오류를 보지 않는다
    if (!editId) {
      for (const field of Object.keys(formErrors)) {
        if (AGREEMENT_FIELDS.some((name) => field.startsWith(name))) {
          delete formErrors[field];
        }
      }
    }

    if (Object.keys(formErrors).length || Object.keys(padErrors).length) {
      setErrors({ ...formErrors, ...padErrors });
      return;
    }

    setErrors({});

    if (editId && validation.valid) {
      void handleEditSave(editId, validation.data);
      return;
    }

    setStep("notice");
    window.scrollTo(0, 0);
  }

  async function handleEditSave(id: number, data: ValidatedContractFormValues) {
    setFormError("");
    setIsSubmitting(true);

    try {
      await updateAdminContract(id, { ...data, products: moveEmptyRowsToEnd(data.products) });
      router.push(`/admin/contracts/${id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          router.push("/admin/login");
          return;
        }

        setFormError(error.message);

        if (error.errors) {
          setErrors(error.errors);
        }
      } else {
        setFormError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNoticeSubmit() {
    const validation = validateContractForm(values);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    // 4호 러그 사전 동의서는 동의·서명 장에서 받는다. 문항을 모두 골라야 제출(답이 "동의하지 않음"이어도 제출은 된다)
    const missingSize4 = getSize4DeliveryKinds(values.products).some(
      (kind) => !isSize4DeliveryAnswered(kind, values.size4DeliveryAnswers),
    );
    if (missingSize4) {
      setErrors({ size4DeliveryAnswers: "4호 러그 배송 안내 및 사전 동의를 작성해주세요." });
      return;
    }

    setErrors({});
    setFormError("");
    setIsSubmitting(true);

    try {
      const noticeAnnotation = noticeAnnotatorRef.current?.getAnnotation();
      const result = await submitContract({
        ...validation.data,
        products: moveEmptyRowsToEnd(validation.data.products),
        ...(noticeAnnotation ? { noticeAnnotation } : {}),
      });
      clearDraft();
      router.push(
        `/contract/complete?contractNumber=${encodeURIComponent(result.contractNumber)}&viewToken=${encodeURIComponent(result.viewToken)}`,
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);

        if (error.errors) {
          setErrors(error.errors);
        }
      } else {
        setFormError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-page">
      <div className="app-container app-container--doc">
        {step === "form" ? (
          editId ? (
            <Link href={`/admin/contracts/${editId}`} className="app-back-link">
              ← 계약서 상세로 돌아가기 (수정 중: {editContractNumber})
            </Link>
          ) : (
            <Link href="/" className="app-back-link">
              ← 홈으로
            </Link>
          )
        ) : (
          <button
            type="button"
            className="app-back-link"
            onClick={() => {
              setStep("form");
              window.scrollTo(0, 0);
            }}
          >
            ← 계약서 작성으로 돌아가기
          </button>
        )}

        {step === "notice" ? (
          <div className="contract-doc-flow contract-doc-flow--attached">
            {formError ? (
              <p className="app-alert app-alert--error contract-doc-flow__alert">
                {formError}
              </p>
            ) : null}

            <NoticeAnnotator ref={noticeAnnotatorRef} />

            <div className="contract-doc-flow__actions">
              {/* 안내문을 읽은 뒤 동의·서명하도록 안내문 아래에 둔다 (필기 캔버스 밖이라 입력 가능) */}
              <div className="contract-doc">
                <ContractAgreementBox values={values} errors={errors} onChange={handleChange} />
              </div>

              <button
                type="button"
                className="app-button app-button--block"
                disabled={!values.termsAgreed || isSubmitting}
                onClick={handleNoticeSubmit}
              >
                {isSubmitting ? "제출 중..." : "계약서 제출"}
              </button>

              <ContractCompanyFooter />
            </div>
          </div>
        ) : null}

        {/* 안내 단계에서도 언마운트하지 않아 입력값·서명 상태 유지 */}
        <div className="contract-doc-flow" hidden={step !== "form"}>
          {formError ? (
            <p className="app-alert app-alert--error contract-doc-flow__alert">
              {formError}
            </p>
          ) : null}

          <ContractForm
            values={values}
            errors={errors}
            isSubmitting={isSubmitting}
            submitLabel={editId ? "수정 저장" : undefined}
            showAgreement={editId !== null}
            productSelections={productSelections}
            setComponentSelections={setComponentSelections}
            onChange={handleChange}
            onProductChange={handleProductChange}
            onProductSelect={handleProductSelect}
            onAddProductRow={handleAddProductRow}
            onClearProductRow={handleClearProductRow}
            onRemoveLastProductRow={handleRemoveLastProductRow}
            onClearAllProductRows={handleClearAllProductRows}
            onSetComponentChange={handleSetComponentChange}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}
