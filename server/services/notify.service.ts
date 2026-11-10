// 팝빌 알림톡·문자로 고객용 계약서 링크를 보낸다.
// POPBILL_SEND_ENABLED=true 가 아니면 팝빌을 호출하지 않고 로그만 남긴다 (템플릿 검수 전 세팅용).
const popbill = require("popbill"); // 타입 정의가 없는 CommonJS SDK

// 알림톡 본문은 카카오에 검수 등록한 템플릿과 글자 하나까지 같아야 발송된다.
// 템플릿 등록 시 아래 문구에서 #{...} 부분을 변수로 등록할 것.
const ALIMTALK_TEMPLATE =
  "#{고객명}님, 계약서가 발행되었습니다.\n\n" +
  "계약번호: #{계약번호}\n" +
  "아래 링크에서 계약서를 확인하실 수 있습니다. (발급일로부터 90일간 유효)\n" +
  "#{링크}";

const ALT_SEND_SAME_CONTENT = "C"; // 알림톡 실패 시 알림톡과 같은 내용으로 대체문자 발송

export type ContractLinkTarget = {
  contractNumber: string;
  customerName: string;
  customerPhone: string;
  viewToken: string;
};

export type NotifyResult = "sent" | "skipped";

let configured = false;

function getConfig() {
  return {
    corpNum: process.env.POPBILL_CORP_NUM ?? "",
    templateCode: process.env.POPBILL_ALIMTALK_TEMPLATE_CODE ?? "",
    sender: process.env.POPBILL_SENDER_NUMBER ?? "",
  };
}

function ensureConfigured() {
  if (configured) return;

  popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: process.env.POPBILL_IS_TEST !== "false", // 명시적으로 false일 때만 운영 환경
  });
  configured = true;
}

function isSendEnabled() {
  return process.env.POPBILL_SEND_ENABLED === "true";
}

export function buildCustomerLinkUrl(contractNumber: string, viewToken: string) {
  const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
  return `${origin}/contract/view/${encodeURIComponent(contractNumber)}?token=${encodeURIComponent(viewToken)}`;
}

function buildMessage(target: ContractLinkTarget) {
  return ALIMTALK_TEMPLATE.replace("#{고객명}", target.customerName)
    .replace("#{계약번호}", target.contractNumber)
    .replace("#{링크}", buildCustomerLinkUrl(target.contractNumber, target.viewToken));
}

function toDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

// 계약서 발행 시 알림톡 발송 (실패하면 팝빌이 대체문자로 보냄)
export function sendContractLinkAlimtalk(target: ContractLinkTarget): Promise<NotifyResult> {
  const message = buildMessage(target);

  if (!isSendEnabled()) {
    console.info(`[notify] 발송 꺼짐 - 알림톡 생략 (${target.contractNumber})`);
    return Promise.resolve("skipped");
  }

  ensureConfigured();
  const { corpNum, templateCode, sender } = getConfig();

  return new Promise((resolve, reject) => {
    popbill.KakaoService().sendATS_one(
      corpNum,
      templateCode,
      sender,
      message,
      message,
      ALT_SEND_SAME_CONTENT,
      "",
      toDigits(target.customerPhone),
      target.customerName,
      () => resolve("sent"),
      reject,
    );
  });
}

// 관리자 상세에서 문자로 재발송 (길이에 따라 팝빌이 SMS/LMS 자동 선택)
export function sendContractLinkSms(target: ContractLinkTarget): Promise<NotifyResult> {
  const message = buildMessage(target);

  if (!isSendEnabled()) {
    console.info(`[notify] 발송 꺼짐 - 문자 생략 (${target.contractNumber})`);
    return Promise.resolve("skipped");
  }

  ensureConfigured();
  const { corpNum, sender } = getConfig();

  return new Promise((resolve, reject) => {
    popbill.MessageService().sendXMS(
      corpNum,
      sender,
      toDigits(target.customerPhone),
      target.customerName,
      "계약서 안내",
      message,
      "",
      () => resolve("sent"),
      reject,
    );
  });
}
