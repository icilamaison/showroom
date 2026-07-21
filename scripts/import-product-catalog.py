#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = Path.home() / "Downloads/icilamaison_20260721_9927_2558 (1).csv"
JSON_PATH = ROOT / "product.json"


def extract_braced(prefix: str, text: str) -> list[str]:
    match = re.search(rf"{re.escape(prefix)}\{{([^}}]*)\}}", text)
    if not match:
        return []
    return [value.strip() for value in match.group(1).split("|") if value.strip()]


def parse_hex_colors(color_setting: str) -> list[str]:
    if not color_setting:
        return []

    inner = color_setting.strip()
    if inner.startswith("{") and inner.endswith("}"):
        inner = inner[1:-1]

    colors: list[str] = []
    for part in inner.split("|"):
        value = part.strip()
        if not value:
            continue
        if not value.startswith("#"):
            value = f"#{value.lstrip('#')}"
        colors.append(value.lower())
    return colors


def parse_colors(option_input: str, color_setting: str) -> dict[str, str] | None:
    names = (
        extract_braced("COLOR", option_input)
        or extract_braced("색상", option_input)
        or extract_braced("구성", option_input)
    )
    if not names:
        return None

    hexes = parse_hex_colors(color_setting)
    if hexes:
        while len(hexes) < len(names):
            hexes.append(hexes[-1])

    return {
        name: hexes[index] if hexes else "#ffffff"
        for index, name in enumerate(names)
    }


def parse_sizes(option_input: str) -> list[str] | None:
    sizes = extract_braced("SIZE", option_input)
    return sizes or None


def to_int(value: str) -> int:
    return int(float(value or 0))


def is_set_json(product: dict) -> bool:
    return product["productName"].startswith("[SET]") or bool(product.get("components"))


def is_set_csv(row: dict[str, str]) -> bool:
    return row["상품명"].startswith("[SET]")


def build_category_map(catalog: list[dict]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for product in catalog:
        internal_code = product.get("internalCode", "").strip()
        if internal_code:
            mapping[internal_code] = product["category"]
    return mapping


def infer_category(
    internal_code: str,
    product_name: str,
    category_map: dict[str, str],
) -> str:
    code = internal_code.strip()
    if code and code in category_map:
        return category_map[code]

    name = product_name
    if "러그" in code or "러그" in name:
        return "러그"
    if "매트" in code or "매트" in name:
        return "매트"
    if code in {"프렌치", "오슬로 러그"}:
        return "러그"
    if code.endswith(" 방석") or any(
        keyword in name for keyword in ("방석", "쿠션", "홀더백", "스와치", "샘플")
    ):
        return "ACC"
    if "ICILAMAISON" in name:
        return "ACC"
    if any(keyword in name for keyword in ("패드", "이불", "베개", "베딩", "솜", "침구")):
        return "침구"

    return "ACC"


def csv_row_to_product(row: dict[str, str], category_map: dict[str, str]) -> dict:
    option_input = row.get("옵션입력", "") or ""
    color_setting = row.get("색상 설정", "") or ""
    internal_code = (row.get("자체 상품코드") or "").strip()

    product: dict = {
        "productCode": row["상품코드"],
        "internalCode": internal_code,
        "category": infer_category(internal_code, row["상품명"], category_map),
        "productNo": int(row["상품번호"]),
        "productName": row["상품명"],
        "consumerPrice": to_int(row["소비자가"]),
        "supplyPrice": to_int(row["공급가"]),
        "productPrice": to_int(row["상품가"]),
        "salePrice": to_int(row["판매가"]),
    }

    colors = parse_colors(option_input, color_setting)
    sizes = parse_sizes(option_input)

    if colors:
        product["colors"] = colors
    if sizes:
        product["sizes"] = sizes

    return product


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    with JSON_PATH.open(encoding="utf-8") as file:
        catalog = json.load(file)

    with csv_path.open(newline="", encoding="utf-8-sig") as file:
        rows = list(csv.DictReader(file))

    category_map = build_category_map(catalog)
    existing_by_code = {product["productCode"]: product for product in catalog}
    csv_by_code = {row["상품코드"]: row for row in rows}

    set_products = [product for product in catalog if is_set_json(product)]
    set_codes = {product["productCode"] for product in set_products}

    active_non_set_rows = [
        row
        for row in rows
        if row["진열상태"] == "Y" and not is_set_csv(row)
    ]
    active_non_set_codes = {row["상품코드"] for row in active_non_set_rows}

    updated_products = [
        csv_row_to_product(row, category_map) for row in active_non_set_rows
    ]

    preserved_codes = set(active_non_set_codes) | set_codes
    preserved_non_set = [
        product
        for product in catalog
        if not is_set_json(product)
        and product["productCode"] not in preserved_codes
    ]

    next_catalog = set_products + updated_products + preserved_non_set
    next_catalog.sort(key=lambda product: product["productNo"], reverse=True)

    with JSON_PATH.open("w", encoding="utf-8") as file:
        file.write(json.dumps(next_catalog, ensure_ascii=False, indent=4))
        file.write("\n")

    print(f"[import] CSV: {csv_path}")
    print(f"[import] SET preserved: {len(set_products)}")
    print(f"[import] Active non-SET imported: {len(updated_products)}")
    print(f"[import] Preserved legacy non-SET: {len(preserved_non_set)}")
    print(f"[import] Total products: {len(next_catalog)}")
    print("[import] Restart dev server after import: npm run dev:clean")


if __name__ == "__main__":
    main()
