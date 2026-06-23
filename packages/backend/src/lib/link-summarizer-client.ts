import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const INVOKE_TIMEOUT_MS = 22_000;

export interface SummarizeLinkInput {
  url: string;
  ogTitle: string | null;
  ogDescription: string | null;
}

export interface SummarizeLinkResult {
  summary?: string;
  error?: string;
}

function lambdaClient(): LambdaClient {
  return new LambdaClient({
    region: process.env.AWS_REGION ?? "eu-west-3",
    ...(process.env.IS_OFFLINE === "true"
      ? { endpoint: process.env.LAMBDA_ENDPOINT ?? "http://localhost:3002" }
      : {}),
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("link summarizer timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Appelle la Lambda Python de résumé de lien (sync, best effort). */
export async function summarizeExternalLink(
  input: SummarizeLinkInput,
): Promise<SummarizeLinkResult> {
  const functionName = process.env.LINK_SUMMARIZER_FUNCTION;
  if (!functionName) {
    console.warn("LINK_SUMMARIZER_FUNCTION unset — résumé de lien ignoré");
    return { error: "summarizer not configured" };
  }

  try {
    const response = await withTimeout(
      lambdaClient().send(
        new InvokeCommand({
          FunctionName: functionName,
          InvocationType: "RequestResponse",
          Payload: Buffer.from(
            JSON.stringify({
              url: input.url,
              ogTitle: input.ogTitle,
              ogDescription: input.ogDescription,
            }),
          ),
        }),
      ),
      INVOKE_TIMEOUT_MS,
    );

    if (response.FunctionError) {
      const detail = response.Payload
        ? Buffer.from(response.Payload).toString("utf8")
        : response.FunctionError;
      return { error: detail };
    }

    if (!response.Payload) {
      return { error: "empty payload" };
    }

    const parsed = JSON.parse(Buffer.from(response.Payload).toString("utf8")) as SummarizeLinkResult;
    if (parsed.error) return { error: parsed.error };
    if (!parsed.summary?.trim()) return { error: "empty summary" };
    return { summary: parsed.summary.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("summarizeExternalLink failed:", message);
    return { error: message };
  }
}
