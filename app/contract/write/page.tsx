"use client";

import {
  ApiClientError,
  fetchAdminContractById,
  submitContract,
  updateAdminContract,
} from "@/lib/api-client";
import { findCatalogProductByName, getSizeSalePrice, getTypeSalePrice, getVariantComponents, isSetProduct, searchProducts, withSizeSiblings, type CatalogProduct } from "@/lib/product-catalog";
import {
  buildSetSelectionsFromColor,
  createSetComponentSelections,
  formatSetOptionName,
  resolveComponentPriceForSize,
  type SetComponentSelection,
} from "@/lib/set-product";
import { formatPhoneInput, PHONE_FORM_FIELDS } from "@/lib/phone";
import type {
  ContractFormValues,
  ProductRow,
  ValidatedContractFormValues,
} from "@/lib/validation/contract";
import {
  createEmptyProductRow,
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
import { NoticeAgreeLine } from "../NoticeSheet";
import ContractForm, { createInitialContractFormValues } from "./ContractForm";

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
  // 계약서 작성 → 배송·교환·반품 안내 동의 → 제출 순서
  const [step, setStep] = useState<"form" | "notice">("form");
  const [noticeAgreed, setNoticeAgreed] = useState(false);
  const noticeAnnotatorRef = useRef<NoticeAnnotatorHandle>(null);
  // 관리자 상세의 "수정"으로 들어오면(?edit=계약서ID) 저장된 내용을 채우고, 저장 시 같은 계약서를 고친다
  const [editId, setEditId] = useState<number | null>(null);
  const [editContractNumber, setEditContractNumber] = useState("");

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    if (!Number.isInteger(id) || id <= 0) {
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
        const nextSelections: Record<number, CatalogProduct | null> = {};
        const nextSetSelections: Record<number, SetComponentSelection[]> = {};
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

          nextSelections[index] = withSizeSiblings(catalogProduct);
          if (isSetProduct(catalogProduct)) {
            nextSetSelections[index] = buildSetSelectionsFromColor(
              catalogProduct.components ?? [],
              product.color,
            );
          }
        });

        setValues({ ...createInitialContractFormValues(), ...payload, products });
        setProductSelections(nextSelections);
        setSetComponentSelections(nextSetSelections);
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
    value: string | boolean | null,
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

    const validation = validateContractForm(values);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});

    if (editId) {
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
      await updateAdminContract(id, data);
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
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      const noticeAnnotation = noticeAnnotatorRef.current?.getAnnotation();
      const result = await submitContract({
        ...validation.data,
        ...(noticeAnnotation ? { noticeAnnotation } : {}),
      });
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

            {/* 동의 문구에도 펜으로 표시할 수 있게 필기 영역 안에 둔다 */}
            <NoticeAnnotator
              ref={noticeAnnotatorRef}
              extra={<NoticeAgreeLine checked={noticeAgreed} onChange={setNoticeAgreed} />}
            />

            <div className="contract-doc-flow__actions">

              <button
                type="button"
                className="app-button app-button--block"
                disabled={!noticeAgreed || isSubmitting}
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
            productSelections={productSelections}
            setComponentSelections={setComponentSelections}
            onChange={handleChange}
            onProductChange={handleProductChange}
            onProductSelect={handleProductSelect}
            onAddProductRow={handleAddProductRow}
            onRemoveLastProductRow={handleRemoveLastProductRow}
            onSetComponentChange={handleSetComponentChange}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}
