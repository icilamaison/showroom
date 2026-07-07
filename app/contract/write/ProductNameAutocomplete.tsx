"use client";

import {
  formatCatalogPrice,
  searchProducts,
  type CatalogProduct,
} from "@/lib/product-catalog";
import { useEffect, useId, useRef, useState } from "react";

type ProductNameAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: CatalogProduct) => void;
};

export default function ProductNameAutocomplete({
  value,
  onChange,
  onSelect,
}: ProductNameAutocompleteProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = searchProducts(value);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openSuggestions() {
    if (value.trim()) {
      setIsOpen(true);
    }
  }

  function handleSelect(product: CatalogProduct) {
    onSelect(product);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const showSuggestions = isOpen && suggestions.length > 0;

  return (
    <div ref={containerRef} className="contract-doc__product-autocomplete">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(Boolean(event.target.value.trim()));
        }}
        onFocus={openSuggestions}
        onKeyDown={handleKeyDown}
        className="contract-doc__cell-input"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listId}
        aria-autocomplete="list"
      />

      {showSuggestions ? (
        <ul id={listId} className="contract-doc__product-suggestions" role="listbox">
          {suggestions.map((product, index) => (
            <li key={product.productCode} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`contract-doc__product-suggestion${
                  index === activeIndex
                    ? " contract-doc__product-suggestion--active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(product)}
              >
                <span className="contract-doc__product-suggestion-name">
                  {product.productName}
                </span>
                <span className="contract-doc__product-suggestion-meta">
                  {formatCatalogPrice(product.salePrice)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
