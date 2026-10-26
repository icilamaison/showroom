import catalogData from "../product.json";

export type CatalogSizeOption =
  | string
  | {
      name: string;
      consumerPrice?: number;
      salePrice?: number;
      typePrices?: Record<string, number>;
      components?: SetComponent[];
    };

export type ProductSelectOption = {
  value: string;
  label: string;
};

export type SetComponent = {
  productCode?: string;
  name: string;
  quantity?: number;
  consumerPrice?: number;
  colors?: string[];
  sizes?: string[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
};

export type CatalogProduct = {
  productCode: string;
  internalCode: string;
  category: string;
  productNo: number;
  productName: string;
  consumerPrice: number;
  supplyPrice: number;
  productPrice: number;
  salePrice: number;
  colors?: Record<string, string>;
  // 사이즈 옵션 없이 색상만으로 갈리는 상품 중 일부는 색상별로 실제 판매가가 다름(예: 겨울용/봄가을용)
  colorPrices?: Record<string, number>;
  // TYPE 축(라이트/오리지널, 매트리스 높이 등). 색·사이즈와 독립 선택.
  types?: string[];
  // TYPE마다 판매가가 다른 상품(비벤디 라이트/오리지널). 없는 TYPE은 기본 판매가.
  typePrices?: Record<string, number>;
  sizes?: CatalogSizeOption[];
  components?: SetComponent[];
  soldOutColors?: string[];
  soldOutSizes?: string[];
  soldOutTypes?: string[];
  // withSizeSiblings로 사이즈 형제 상품을 묶었을 때만 채워진다.
  soldOutColorsBySize?: Record<string, string[]>;
  // 컬러 그룹(COLOR_GROUP_NAMES)으로 묶은 가상 상품에만 채워진다.
  soldOutSizesByColor?: Record<string, string[]>;
};

export function getSizeOptionName(option: CatalogSizeOption): string {
  return typeof option === "string" ? option : option.name;
}

export function normalizeProductOptions(
  options: CatalogSizeOption[] | string[] | undefined,
  baseSalePrice?: number,
): ProductSelectOption[] {
  if (!options?.length) {
    return [];
  }

  return options.map((option) => {
    const value = getSizeOptionName(option);
    const salePrice = typeof option === "object" ? option.salePrice : undefined;

    if (
      baseSalePrice != null &&
      salePrice != null &&
      salePrice > baseSalePrice
    ) {
      const addPrice = salePrice - baseSalePrice;
      return {
        value,
        label: `${value} (+${addPrice.toLocaleString("ko-KR")}원)`,
      };
    }

    return { value, label: value };
  });
}

// 품절 옵션을 목록에서 빼면 카페24에서 재고를 다시 채워도 이 화면에서는 고를 수 없다.
// product.json은 동기화 시점의 스냅샷이라 항상 늦다. 지우지 말고 표시만 해서 담당자가 판단하게 한다.
export function withSoldOutLabels(
  options: CatalogSizeOption[] | string[] | undefined,
  soldOutNames: string[] | undefined,
  baseSalePrice?: number,
): ProductSelectOption[] {
  const soldOut = new Set(soldOutNames ?? []);

  return normalizeProductOptions(options, baseSalePrice).map((option) =>
    soldOut.has(option.value)
      ? { ...option, label: `${option.label} (품절)` }
      : option,
  );
}

// 카페24에 "아이보리 미니 100X150"처럼 색상·사이즈를 한 옵션으로 등록한 상품이 많다.
// 저장 값은 품절·가격 매칭 키라 그대로 두고, 계약서 화면에서만 나눠 보여준다.
const COMBINED_SIZE_PATTERN =
  /^(.+?)\s+((?:미니|반호|\d+(?:\.\d+)?호|SS|S|Q|K|패밀리)?\s*\d+\s*[Xx×]\s*\d+.*|원형\s*\d+.*)$/;
// 컬러 뒤에 붙어 온 사이즈 표기. "베이지 Q/K 200X220" → 컬러 "베이지", 사이즈 "Q/K 200X220"
const SIZE_WORDS_IN_COLOR = /\s+(QK겸용|QK|Q\/K)$/;

export function splitColorSize(
  name: string,
): { color: string; size: string } | null {
  // "패드 SS 1P + 홑이불 QK 1P" 같은 세트 조합형은 나누면 의미가 깨진다
  if (name.includes("+")) {
    return null;
  }

  const match = name.trim().match(COMBINED_SIZE_PATTERN);
  if (!match) {
    return null;
  }

  const sizeWords = match[1].match(SIZE_WORDS_IN_COLOR)?.[1];
  return sizeWords
    ? { color: match[1].replace(SIZE_WORDS_IN_COLOR, ""), size: `${sizeWords} ${match[2]}` }
    : { color: match[1], size: match[2] };
}

// "아이보리 미니 100X150" → "아이보리"로 보여주고 사이즈는 사이즈 칸에 따로 표시한다(일반 상품·세트 구성품 공통).
// "내추럴 원형100 / 내추럴 원형145"처럼 색상만 남기면 겹치는 상품은 원래 라벨을 유지한다.
export function withColorOnlyLabels(
  options: ProductSelectOption[],
): ProductSelectOption[] {
  const colors = options.map((option) => splitColorSize(option.value)?.color);
  if (colors.some((color) => !color) || new Set(colors).size !== colors.length) {
    return options;
  }

  return options.map((option, index) => ({
    ...option,
    label: option.label.replace(option.value, colors[index] as string),
  }));
}

export function getSizeSalePrice(
  product: CatalogProduct,
  sizeName: string,
): number | null {
  for (const option of product.sizes ?? []) {
    if (typeof option === "string" || option.name !== sizeName) {
      continue;
    }

    if (option.salePrice != null) {
      return option.salePrice;
    }
  }

  // 컬러 선택 시에도 이 함수로 가격을 조회하므로(ContractForm) colorPrices도 확인
  return product.colorPrices?.[sizeName] ?? null;
}

// 사이즈 형제를 묶은 상품은 사이즈마다 TYPE 가격이 다르므로 사이즈 옵션 값을 먼저 본다.
export function getTypeSalePrice(
  product: CatalogProduct,
  sizeName: string,
  typeName: string,
): number | null {
  if (!typeName) {
    return null;
  }

  for (const option of product.sizes ?? []) {
    if (typeof option !== "string" && option.name === sizeName) {
      return option.typePrices?.[typeName] ?? null;
    }
  }

  return product.typePrices?.[typeName] ?? null;
}

export function getVariantComponents(
  product: CatalogProduct,
  variantName: string,
): SetComponent[] {
  const normalized = variantName.trim();

  if (!normalized) {
    return product.components ?? [];
  }

  for (const option of product.sizes ?? []) {
    if (
      typeof option === "object" &&
      option.name === normalized &&
      option.components?.length
    ) {
      return option.components;
    }
  }

  return product.components ?? [];
}

const catalog = catalogData as CatalogProduct[];

export function searchProducts(query: string, limit = 8): CatalogProduct[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return [...colorGroupProducts, ...sizeGroupProducts, ...catalog]
    .filter((product) => {
      if (
        groupedSizeProducts.has(product) ||
        groupedColorProducts.has(product) ||
        sizeGroupMembers.has(product) ||
        HIDDEN_FROM_SEARCH_PATTERN.test(product.productName)
      ) {
        return false;
      }

      const name = product.productName.toLowerCase();
      const code = product.productCode.toLowerCase();
      const internal = product.internalCode.toLowerCase();

      return (
        name.includes(normalized) ||
        code.includes(normalized) ||
        internal.includes(normalized)
      );
    })
    .slice(0, limit);
}

export function getDefaultColor(product: CatalogProduct): string {
  const colors = product.colors ? Object.keys(product.colors) : [];
  return colors[0] ?? "";
}

export function isSetProduct(product: CatalogProduct): boolean {
  return Boolean(product.components?.length);
}

export function findCatalogProductByName(name: string): CatalogProduct | null {
  const normalized = name.trim();

  if (!normalized) {
    return null;
  }

  return (
    catalog.find((product) => product.productName.trim() === normalized) ?? null
  );
}

// 옵션이 전부 "색상 + 같은 사이즈"인 상품의 그 사이즈. 예: 뉴슬록 3colors → "미니 100X150"
function getSingleCombinedSize(product: CatalogProduct): string | null {
  const names = Object.keys(product.colors ?? {});
  if (!names.length || product.sizes?.length || product.components?.length) {
    return null;
  }

  const sizes = new Set(names.map((name) => splitColorSize(name)?.size));
  const [size] = [...sizes];
  return sizes.size === 1 && size ? size : null;
}

// 정렬 기준. "1호 160X240"의 1이 섞이지 않게 가로X세로만 읽는다.
// 자사몰처럼 사각형(반호 → 1호 → 4호)을 먼저, 원형은 뒤에 지름 순으로 모은다.
const ROUND_SIZE_OFFSET = 1e9;

function getSizeArea(size: string): number {
  const box = size.match(/(\d+)\s*[Xx×]\s*(\d+)/);
  if (box) {
    return Number(box[1]) * Number(box[2]);
  }

  const diameter = Number(size.match(/\d+/)?.[0] ?? 0);
  return ROUND_SIZE_OFFSET + diameter * diameter;
}

// 카페24는 사이즈마다 상품을 따로 등록한다(뉴슬록 3colors=미니, 뉴슬록 1호 160X240 ...).
// 계약서에서는 "Ncolors" 대표 상품 하나를 고르고, 사이즈 칸에서 형제 상품의 사이즈를 고르게 묶는다.
// 형제 기준: 이름이 "대표명 + 공백 + 사이즈"로 시작하고 옵션이 전부 같은 사이즈인 상품.
// "슬록"과 "뉴슬록"처럼 포함 관계인 이름이 섞이지 않도록 startsWith로만 비교한다.
function getSizeBaseName(product: CatalogProduct): string | null {
  const baseName = product.productName.match(/^(.+) \d+colors$/)?.[1];
  return baseName && getSingleCombinedSize(product) ? baseName : null;
}

// 형제 상품의 사이즈. 옵션에 사이즈가 붙어 있으면 그 값,
// "샤인 원형 200"처럼 옵션은 색상만 있고 사이즈가 상품명에만 있으면 상품명 뒷부분을 쓴다.
function getSiblingSize(candidate: CatalogProduct, baseName: string): string | null {
  if (
    !candidate.productName.startsWith(`${baseName} `) ||
    /colors$/.test(candidate.productName)
  ) {
    return null;
  }

  const rest = candidate.productName.slice(baseName.length + 1);
  const combinedSize = getSingleCombinedSize(candidate);
  if (combinedSize) {
    return rest.startsWith(combinedSize.split(" ")[0]) ? combinedSize : null;
  }

  const colorNames = Object.keys(candidate.colors ?? {});
  const isPlainColors =
    colorNames.length > 0 &&
    !candidate.sizes?.length &&
    !candidate.components?.length &&
    colorNames.every((name) => !splitColorSize(name));
  return isPlainColors && splitColorSize(`_ ${rest}`)?.size === rest ? rest : null;
}

function getSizeSiblings(product: CatalogProduct): CatalogProduct[] {
  const baseName = getSizeBaseName(product);
  if (!baseName) {
    return [];
  }

  return catalog.filter(
    (candidate) =>
      candidate !== product && getSiblingSize(candidate, baseName) != null,
  );
}

export function withSizeSiblings(product: CatalogProduct): CatalogProduct {
  const baseName = getSizeBaseName(product) ?? "";
  const getMemberSize = (member: CatalogProduct) =>
    member === product
      ? (getSingleCombinedSize(product) as string)
      : (getSiblingSize(member, baseName) as string);
  const members = [product, ...getSizeSiblings(product)].sort(
    (a, b) => getSizeArea(getMemberSize(a)) - getSizeArea(getMemberSize(b)),
  );

  if (members.length < 2) {
    return product;
  }

  const colors: Record<string, string> = {};
  for (const member of members) {
    for (const [name, hex] of Object.entries(member.colors ?? {})) {
      const color = splitColorSize(name)?.color ?? name;
      colors[color] = colors[color] || hex;
    }
  }

  // 품절은 사이즈별로 다르다. 해당 사이즈에 없는 색상도 고르지 못하게 품절로 표시한다.
  const soldOutColorsBySize: Record<string, string[]> = {};
  const sizes = members.map((member) => {
    const size = getMemberSize(member);
    const soldOut = new Set(member.soldOutColors ?? []);
    const available = new Map(
      Object.keys(member.colors ?? {}).map((name) => [
        splitColorSize(name)?.color ?? name,
        name,
      ]),
    );
    soldOutColorsBySize[size] = Object.keys(colors).filter((color) => {
      const name = available.get(color);
      return !name || soldOut.has(name);
    });

    return {
      name: size,
      consumerPrice: member.consumerPrice,
      salePrice: member.salePrice,
      typePrices: member.typePrices,
    };
  });

  return {
    ...product,
    colors,
    colorPrices: undefined,
    sizes,
    soldOutColors: [],
    soldOutSizes: sizes
      .filter((size) => soldOutColorsBySize[size.name].length === Object.keys(colors).length)
      .map((size) => size.name),
    soldOutColorsBySize,
  };
}

// 대표 상품에 묶인 사이즈 상품은 검색에서 뺀다.
// 같은 상품을 두 경로로 고르면 저장 값이 "오트밀" / "오트밀 2호 200X300"으로 갈리기 때문.
// 데이터는 그대로라 이름 조회(findCatalogProductByName)는 영향 없다.
const groupedSizeProducts = new Set(catalog.flatMap(getSizeSiblings));

// 공동구매 전용·테스트·사은품 상품은 쇼룸 계약서에서 고를 일이 없어 검색에서 뺀다.
const HIDDEN_FROM_SEARCH_PATTERN = /공동구매|테스트|test|사은품/i;

// 카페24에 컬러마다 상품을 따로 등록한 매트류(그레인 매트 샌드브라운 / 스톤블랙 ...).
// 대표 상품이 없어 이름 규칙만으로 묶으면 룸슈즈 타입·베개커버 형태까지 섞이므로 그룹명을 고정한다.
// 같은 그룹에 새 컬러 상품이 생기면 "그룹명 컬러" 이름이라 자동으로 들어온다. 새 그룹만 여기에 추가.
const COLOR_GROUP_NAMES = [
  "그레인 매트",
  "포그 매트",
  "헤더 매트",
  "케이드 매트",
  "핀 매트",
  "유니드 매트",
  "코트 매트",
  "베티 매트",
  "스트라이프 매트",
  "아카네 매트",
  "웨이 터프팅 매트",
  "떼르 매트",
  "플루아 블랭킷",
  // 지금은 블랙만 진열 중이지만 매트·컬러를 나눠 고르도록 묶는다(로지브릭·프렌치블루 재진열 시 자동 포함)
  "플루아 매트",
  // 프렌치블루만 진열 중. 블랙·소프트브라운 재진열 시 자동 포함
  "노트 매트",
];

function getColorGroupMembers(groupName: string): CatalogProduct[] {
  return catalog.filter(
    (product) =>
      product.productName.startsWith(`${groupName} `) &&
      !Object.keys(product.colors ?? {}).length &&
      !product.components?.length &&
      !/사은품|colors$/.test(product.productName) &&
      !HIDDEN_FROM_SEARCH_PATTERN.test(product.productName),
  );
}

// 그룹명으로 고르는 가상 상품. 컬러 = 멤버 상품명의 나머지, 사이즈·가격·품절은 멤버 상품 값 그대로.
// 계약서에는 "그레인 매트 / 샌드브라운 / M 48X120"으로 저장돼 엑셀 상품명은 실제 상품명과 같아진다.
function buildColorGroupProduct(
  groupName: string,
  members: CatalogProduct[],
): CatalogProduct {
  const sizes: CatalogSizeOption[] = [];
  const sizesByColor: Record<string, string[]> = {};
  const soldOutByColor: Record<string, Set<string>> = {};

  for (const member of members) {
    const color = member.productName.slice(groupName.length + 1);
    // 플루아 블랭킷은 사이즈 옵션에 컬러가 붙어 있다("브릭 M 75X100")
    const stripColor = (name: string) =>
      name.startsWith(`${color} `) ? name.slice(color.length + 1) : name;

    sizesByColor[color] = [];
    soldOutByColor[color] = new Set((member.soldOutSizes ?? []).map(stripColor));

    for (const option of member.sizes ?? []) {
      const name = stripColor(getSizeOptionName(option));
      sizesByColor[color].push(name);
      if (!sizes.some((size) => getSizeOptionName(size) === name)) {
        sizes.push(typeof option === "string" ? name : { ...option, name });
      }
    }
  }

  const sizeNames = sizes.map(getSizeOptionName);
  // 해당 컬러에 없는 사이즈도 고르지 못하게 품절로 표시한다
  const soldOutSizesByColor = Object.fromEntries(
    Object.keys(sizesByColor).map((color) => [
      color,
      sizeNames.filter(
        (name) =>
          !sizesByColor[color].includes(name) || soldOutByColor[color].has(name),
      ),
    ]),
  );

  return {
    ...members[0],
    productName: groupName,
    colors: Object.fromEntries(Object.keys(sizesByColor).map((color) => [color, ""])),
    sizes,
    soldOutColors: Object.keys(sizesByColor).filter(
      (color) => soldOutSizesByColor[color].length === sizeNames.length,
    ),
    soldOutSizes: [],
    soldOutSizesByColor,
  };
}

const groupedColorProducts = new Set<CatalogProduct>();
const colorGroupProducts = COLOR_GROUP_NAMES.flatMap((groupName) => {
  const members = getColorGroupMembers(groupName);
  // 목록에 직접 적은 그룹이라 컬러가 하나뿐이어도 묶는다(플루아 매트)
  if (!members.length) {
    return [];
  }

  members.forEach((member) => groupedColorProducts.add(member));
  return [buildColorGroupProduct(groupName, members)];
});

/* ---------- 목록으로 묶는 사이즈 그룹 ---------- */
// 대표 상품명에 "Ncolors"가 없거나(마레 / 마레 2호 200X290 ...), 형제 상품 옵션 표기가 달라
// 자동으로 안 묶이는 상품(나이트템프 차렵이불 2colors / Q/K "크림화이트 QK겸용 200X230")을 그룹명으로 묶는다.
// 클린트(같은 이름 상품 2개), 쿨포터 냉감 패드 Q(상품명·옵션 사이즈 불일치), 이불솜류는 일부러 뺐다.
const SIZE_GROUP_NAMES = [
  "마레",
  "러프 스퀘어",
  "러프 다이아",
  "사하라",
  "프레임",
  "샌드",
  "몬타",
  "코티지",
  "노블",
  "베이",
  "유닛 아이보리",
  "유닛 베이지",
  "스트라이프",
  "드로잉 라인",
  "드로잉 그리드",
  "르네 워셔블",
  "우디 대자리",
  "쿨포터 냉감 홑이불",
  "쿨포터 냉감 패드",
  "부클",
  "나이트템프 차렵이불",
  "본느윗프레임 차렵이불",
  "아카네 차렵이불",
  "본느윗 차렵이불",
  "오브 차렵이불",
  "인견 이불",
  "인견 패드",
  "본느윗 매트리스커버",
  "블록 워셔블",
];
const SIZE_GROUP_EXCLUDED_PRODUCT_NOS = [846]; // 쿨포터 냉감 패드 Q: 상품명 150X205, 옵션 155X205
const BOX_SIZE_PATTERN = /\d+\s*[Xx×]\s*\d+/;

type SizeGroupOption = {
  member: CatalogProduct;
  field: "COLOR" | "SIZE";
  raw: string;
  color: string;
  size: string;
  salePrice: number;
};

// 멤버 상품의 상품명 뒷부분(사이즈). 없으면 대표 상품이라 "".
function getSizeGroupRest(member: CatalogProduct, groupName: string): string | null {
  if (member.productName === groupName) {
    return "";
  }

  const rest = member.productName
    .slice(groupName.length + 1)
    .replace(/\s*ORDER-MADE$/, "")
    .trim();
  if (/^\d+colors$/.test(rest)) {
    return "";
  }

  // "2호 200X290" / "Q" / "Q/K 200X220"처럼 사이즈로만 된 뒷부분만 멤버로 본다(스트라이프 매트 올리브 제외)
  return rest &&
    (splitColorSize(`_ ${rest}`)?.size === rest ||
      /^(SS|Q|K|Q\/K)(\s+\d+\s*[Xx×]\s*\d+)?$/.test(rest))
    ? rest
    : null;
}

function getSizeGroupOptions(groupName: string): SizeGroupOption[] {
  const options: SizeGroupOption[] = [];

  for (const member of catalog) {
    const isMember =
      (member.productName === groupName || member.productName.startsWith(`${groupName} `)) &&
      !member.components?.length &&
      !SIZE_GROUP_EXCLUDED_PRODUCT_NOS.includes(member.productNo) &&
      !HIDDEN_FROM_SEARCH_PATTERN.test(member.productName);
    const rest = isMember ? getSizeGroupRest(member, groupName) : null;
    if (rest == null) {
      continue;
    }

    // 블록 워셔블·샌드처럼 컬러가 SIZE 옵션에 붙어 오는 상품도 있다
    const colorNames = Object.keys(member.colors ?? {});
    const field = colorNames.length ? "COLOR" : "SIZE";
    const rawOptions = colorNames.length
      ? colorNames.map((name) => ({ name, salePrice: member.salePrice }))
      : (member.sizes ?? []).map((option) => ({
          name: getSizeOptionName(option),
          salePrice:
            (typeof option === "object" ? option.salePrice : undefined) ?? member.salePrice,
        }));

    for (const { name, salePrice } of rawOptions) {
      const split = splitColorSize(name);
      if (!split) {
        continue;
      }

      // 인견 패드 "베이지 Q 155X210 (밴드탈부착형)"의 괄호는 사이즈가 아니라 제품 형태라 컬러 쪽에 붙인다
      const note = split.size.match(/\s*(\([^)]*\))$/)?.[1];
      const color = [split.color, note].filter(Boolean).join(" ");
      const optionSize = note ? split.size.slice(0, -note.length).trim() : split.size;
      // 상품명에 치수가 있으면 상품명을 따른다. 러프 3호처럼 옵션값이 "다이아 2호 200X290"으로 잘못 들어간 상품이 있다
      const size = BOX_SIZE_PATTERN.test(rest) ? rest : optionSize;
      options.push({ member, field, raw: name, color, size, salePrice });
    }
  }

  return options;
}

const sizeGroupMembers = new Set<CatalogProduct>();
const sizeGroupOptionsByName = new Map<string, SizeGroupOption[]>();
const sizeGroupProducts = SIZE_GROUP_NAMES.flatMap((groupName) => {
  const options = getSizeGroupOptions(groupName);
  const members = [...new Set(options.map((option) => option.member))];
  if (members.length < 2) {
    return [];
  }

  members.forEach((member) => sizeGroupMembers.add(member));
  sizeGroupOptionsByName.set(groupName, options);

  const colors = Object.fromEntries(
    options.map((option) => [option.color, option.member.colors?.[option.raw] ?? ""]),
  );
  const sizes = [...new Set(options.map((option) => option.size))]
    .sort((a, b) => getSizeArea(a) - getSizeArea(b))
    .map((size) => ({
      name: size,
      salePrice: options.find((option) => option.size === size)?.salePrice,
    }));

  // 품절은 사이즈별. 해당 사이즈에 없는 컬러도 고르지 못하게 품절로 표시한다
  const soldOutColorsBySize = Object.fromEntries(
    sizes.map(({ name }) => [
      name,
      Object.keys(colors).filter((color) => {
        const option = options.find((item) => item.size === name && item.color === color);
        return (
          !option ||
          [...(option.member.soldOutColors ?? []), ...(option.member.soldOutSizes ?? [])].includes(
            option.raw,
          )
        );
      }),
    ]),
  );
  const colorCount = Object.keys(colors).length;
  const base = members.find((member) => member.productName === groupName) ?? members[0];

  return [
    {
      ...base,
      productName: groupName,
      salePrice: sizes[0]?.salePrice ?? base.salePrice,
      colors,
      colorPrices: undefined,
      sizes,
      soldOutColors: [],
      soldOutSizes: sizes
        .filter(({ name }) => soldOutColorsBySize[name].length === colorCount)
        .map(({ name }) => name),
      soldOutColorsBySize,
    } as CatalogProduct,
  ];
});

// 엑셀(플레이오토)용: 계약서에서 묶어 고른 값을 실제 카페24 상품명과 원래 옵션값으로 되돌린다.
// 예: 슬록 8colors / 아이보리 / 1호 160X240 → 슬록 1호 160X240 / COLOR=아이보리 1호 160X240
//     그레인 매트 / 샌드브라운 / M 48X120 → 그레인 매트 샌드브라운 / SIZE=M 48X120
// 카탈로그에서 못 찾는 값(직접 입력 등)은 고른 값 그대로 둔다.
export function resolveCafe24Variant(
  name: string,
  color: string,
  size: string,
): { productName: string; color: string; size: string } {
  const productName = name.trim();

  const sizeGroupOption = sizeGroupOptionsByName
    .get(productName)
    ?.find((option) => option.color === color && option.size === size);
  if (sizeGroupOption) {
    return {
      productName: sizeGroupOption.member.productName,
      color: sizeGroupOption.field === "COLOR" ? sizeGroupOption.raw : "",
      size: sizeGroupOption.field === "SIZE" ? sizeGroupOption.raw : "",
    };
  }

  if (COLOR_GROUP_NAMES.includes(productName)) {
    const member = catalog.find(
      (product) =>
        groupedColorProducts.has(product) &&
        product.productName === `${productName} ${color}`,
    );
    if (member) {
      // 플루아 블랭킷처럼 원래 사이즈 옵션에 컬러가 붙은 상품은 원래 값으로 되돌린다
      const rawSize =
        (member.sizes ?? [])
          .map(getSizeOptionName)
          .find((option) => option === size || option === `${color} ${size}`) ?? size;
      return { productName: member.productName, color: "", size: rawSize };
    }
  }

  const product = findCatalogProductByName(productName);
  const baseName = product ? getSizeBaseName(product) : null;
  if (product && baseName && size) {
    const member = [product, ...getSizeSiblings(product)].find((candidate) =>
      candidate === product
        ? getSingleCombinedSize(product) === size
        : getSiblingSize(candidate, baseName) === size,
    );
    if (member) {
      const rawColor =
        Object.keys(member.colors ?? {}).find(
          (option) => (splitColorSize(option)?.color ?? option) === color,
        ) ?? color;
      return { productName: member.productName, color: rawColor, size: "" };
    }
  }

  return { productName, color, size };
}

export function findCatalogProductByCode(code: string): CatalogProduct | null {
  const normalized = code.trim();

  if (!normalized) {
    return null;
  }

  return (
    catalog.find((product) => product.productCode === normalized) ?? null
  );
}

export function formatCatalogPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}
