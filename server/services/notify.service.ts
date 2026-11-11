// 비즈고(인포뱅크) 통합메시지 API로 고객용 계약서 링크를 보낸다.
// BIZGO_SEND_ENABLED=true 가 아니면 비즈고를 호출하지 않고 로그만 남긴다.
import { VIEW_TOKEN_VALID_DAYS } from "./admin-contract.service";

// 알림톡 본문·타이틀·버튼은 카카오 승인 템플릿(showroom_contract)과 글자 하나까지 같아야 발송된다.
const ALIMTALK_TITLE = "작성 완료";
const ALIMTALK_TEMPLATE =
  "#{고객명}님, 쇼룸에서 작성하신 구매 계약서를 보내드려요.\n\n" +
  "- 상품명 : #{상품요약}\n" +
  "- 작성일 : #{작성일}\n" +
  "- 열람 기한 : #{만료일}까지\n\n" +
  "계약 내용과 배송·교환·반품 안내를 확인하시려면 아래 버튼을 눌러 주세요.\n\n" +
  "※ 쇼룸에서 상품을 구매하신 고객님께 보내드리는 안내예요.";
const ALIMTALK_BUTTON_NAME = "계약서 확인";
// 템플릿 버튼 링크가 이 도메인으로 등록되어 있어 CLIENT_ORIGIN과 무관하게 고정
const ALIMTALK_LINK_ORIGIN = "https://showroom.icilamaison.com";

const SMS_TITLE = "계약서 안내";
const SUCCESS_CODE = "A000";

export type ContractLinkTarget = {
  contractNumber: string;
  customerName: string;
  customerPhone: string;
  viewToken: string;
};

export type NotifyResult = "sent" | "skipped";

function getConfig() {
  return {
    // 샌드박스: https://sandbox-mars.ibapi.kr
    baseUrl: process.env.BIZGO_BASE_URL ?? "https://mars.ibapi.kr",
    apiKey: process.env.BIZGO_API_KEY ?? "",
    senderKey: process.env.BIZGO_SENDER_KEY ?? "",
    templateCode: process.env.BIZGO_ALIMTALK_TEMPLATE_CODE ?? "",
    sender: process.env.BIZGO_SENDER_NUMBER ?? "",
  };
}

function isSendEnabled() {
  return process.env.BIZGO_SEND_ENABLED === "true";
}

export function buildCustomerLinkUrl(
  contractNumber: string,
  viewToken: string,
  origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
) {
  return `${origin}/contract/view/${encodeURIComponent(contractNumber)}?token=${encodeURIComponent(viewToken)}`;
}

// 서버가 UTC여도 한국 날짜로 표기 (YYYY-MM-DD)
function formatKstDate(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

// "러그A, 패드B, 스트랩C" → "러그A 외 2건"
function summarizeProducts(productName: string) {
  const names = productName.split(", ").filter(Boolean);
  if (names.length <= 1) return productName;
  return `${names[0]} 외 ${names.length - 1}건`;
}

function buildAlimtalkText(target: ContractLinkTarget, productName: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VIEW_TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000);

  return ALIMTALK_TEMPLATE.replace("#{고객명}", target.customerName)
    .replace("#{상품요약}", summarizeProducts(productName))
    .replace("#{작성일}", formatKstDate(now))
    .replace("#{만료일}", formatKstDate(expiresAt));
}

function buildSmsText(target: ContractLinkTarget) {
  return (
    `${target.customerName}님, 쇼룸에서 작성하신 구매 계약서를 보내드려요.\n` +
    `아래 링크에서 계약서를 확인하실 수 있습니다.\n` +
    buildCustomerLinkUrl(target.contractNumber, target.viewToken)
  );
}

function toDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

// messageFlow 순서대로 시도하고 앞 채널이 실패하면 다음 채널로 대체발송된다
async function sendOmni(target: ContractLinkTarget, messageFlow: object[]) {
  const { baseUrl, apiKey } = getConfig();

  const res = await fetch(`${baseUrl}/api/comm/v1/send/omni`, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      destinations: [{ to: toDigits(target.customerPhone) }],
      messageFlow,
      ref: target.contractNumber,
    }),
  });
  const body = await res.json().catch(() => null);

  if (!res.ok || body?.data?.code !== SUCCESS_CODE) {
    throw new Error(`[bizgo] 발송 실패 (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
}

// 문자(LMS) — 본문이 90byte를 넘으므로 mms 객체로 보낸다 (이미지 없으면 LMS)
function lmsFlow(text: string) {
  return { mms: { from: getConfig().sender, title: SMS_TITLE, text } };
}

// 계약서 발행 시 알림톡 발송 (발신번호가 등록돼 있으면 실패 시 문자 대체발송)
export async function sendContractLinkAlimtalk(
  target: ContractLinkTarget & { productName: string },
): Promise<NotifyResult> {
  if (!isSendEnabled()) {
    console.info(`[notify] 발송 꺼짐 - 알림톡 생략 (${target.contractNumber})`);
    return "skipped";
  }

  const { senderKey, templateCode, sender } = getConfig();
  const link = buildCustomerLinkUrl(target.contractNumber, target.viewToken, ALIMTALK_LINK_ORIGIN);
  const messageFlow: object[] = [
    {
      alimtalk: {
        msgType: "AT",
        senderKey,
        templateCode,
        title: ALIMTALK_TITLE,
        text: buildAlimtalkText(target, target.productName),
        attachment: {
          button: [{ type: "WL", name: ALIMTALK_BUTTON_NAME, urlMobile: link, urlPc: link }],
        },
      },
    },
  ];
  // ponytail: 비즈고 발신번호 미등록 상태라 번호가 있을 때만 대체발송을 붙인다
  if (sender) messageFlow.push(lmsFlow(buildSmsText(target)));

  await sendOmni(target, messageFlow);
  return "sent";
}

// 관리자 상세에서 문자로 재발송
export async function sendContractLinkSms(target: ContractLinkTarget): Promise<NotifyResult> {
  if (!isSendEnabled()) {
    console.info(`[notify] 발송 꺼짐 - 문자 생략 (${target.contractNumber})`);
    return "skipped";
  }

  await sendOmni(target, [lmsFlow(buildSmsText(target))]);
  return "sent";
}
