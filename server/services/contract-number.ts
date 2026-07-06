import type { PoolClient } from "pg";

const CONTRACT_PREFIX = "CT";
const MAX_RETRIES = 5;
const TIMEZONE = "Asia/Seoul";

export function formatDatePrefix(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, "");
}

export function formatContractNumber(
  datePrefix: string,
  sequence: number,
): string {
  if (sequence < 1 || sequence > 9999) {
    throw new Error("Contract sequence must be between 1 and 9999");
  }

  return `${CONTRACT_PREFIX}-${datePrefix}-${String(sequence).padStart(4, "0")}`;
}

export function parseContractSequence(contractNumber: string): number {
  const match = contractNumber.match(/^CT-\d{8}-(\d{4})$/);

  if (!match) {
    throw new Error(`Invalid contract number format: ${contractNumber}`);
  }

  return Number.parseInt(match[1], 10);
}

export async function getNextContractSequence(
  client: PoolClient,
  datePrefix: string,
): Promise<number> {
  const pattern = `${CONTRACT_PREFIX}-${datePrefix}-%`;

  const result = await client.query<{ contract_number: string }>(
    `SELECT contract_number
     FROM contracts
     WHERE contract_number LIKE $1
     ORDER BY contract_number DESC
     LIMIT 1
     FOR UPDATE`,
    [pattern],
  );

  if (result.rowCount === 0) {
    return 1;
  }

  return parseContractSequence(result.rows[0].contract_number) + 1;
}

export async function generateContractNumber(
  client: PoolClient,
  date: Date = new Date(),
): Promise<string> {
  const datePrefix = formatDatePrefix(date);
  const sequence = await getNextContractSequence(client, datePrefix);
  return formatContractNumber(datePrefix, sequence);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export async function withContractNumberRetry<T>(
  client: PoolClient,
  operation: (contractNumber: string) => Promise<T>,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const contractNumber = await generateContractNumber(client);

    try {
      return await operation(contractNumber);
    } catch (error) {
      lastError = error;

      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to allocate unique contract number");
}
