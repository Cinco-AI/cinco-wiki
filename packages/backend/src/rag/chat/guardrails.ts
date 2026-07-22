import { ragConfig } from "../config.js";

const OUT_OF_SCOPE_ANSWER_FR =
  "Je suis l'assistant Cinco Wiki — je peux vous aider à retrouver des informations dans les notes publiées de l'équipe. Que souhaitez-vous savoir ?";

const OUT_OF_SCOPE_ANSWER_EN =
  "I am the Cinco Wiki assistant — I can help you find information in the team's published notes. What would you like to know?";

const NO_RESULT_ANSWER_FR =
  "Je n'ai rien trouvé dans les notes indexées. Essayez d'autres mots-clés ou un tag.";

const NO_RESULT_ANSWER_EN =
  "I could not find a match in the indexed notes. Try different keywords or a tag.";

const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above)\s+instructions/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /you\s+are\s+now\s+(chatgpt|claude|gpt)/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(diagnostic|médicament|ordonnance|maladie)\b/i,
  /\b(bitcoin|crypto\s+trading|forex)\b/i,
  /\b(amazon|aliexpress|temu)\b/i,
];

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function resolveLocale(locale?: string | null): "fr" | "en" {
  const lang = (locale || "fr").toLowerCase();
  if (lang.startsWith("en")) return "en";
  return "fr";
}

export function sanitizeInput(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ragConfig.maxInputChars);
}

export function isLikelyJailbreak(message: string): boolean {
  return JAILBREAK_PATTERNS.some((re) => re.test(message));
}

export function isLikelyOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some((re) => re.test(message));
}

export function outOfScopeAnswer(locale?: string | null): string {
  return resolveLocale(locale) === "en"
    ? OUT_OF_SCOPE_ANSWER_EN
    : OUT_OF_SCOPE_ANSWER_FR;
}

export function noResultAnswer(locale?: string | null): string {
  return resolveLocale(locale) === "en"
    ? NO_RESULT_ANSWER_EN
    : NO_RESULT_ANSWER_FR;
}

const TEMP_UNAVAILABLE_FR =
  "L'assistant est temporairement indisponible. Réessayez dans un instant.";

const TEMP_UNAVAILABLE_EN =
  "The assistant is temporarily unavailable. Please try again in a moment.";

const RATE_LIMITED_FR =
  "Trop de questions en peu de temps. Patientez une minute puis réessayez.";

const RATE_LIMITED_EN =
  "Too many questions in a short time. Please wait a minute and try again.";

const TIMEOUT_FR =
  "La réponse a pris trop de temps. Reformulez votre question ou réessayez.";

const TIMEOUT_EN =
  "The answer took too long. Please rephrase your question or try again.";

export function temporaryUnavailableAnswer(locale?: string | null): string {
  return resolveLocale(locale) === "en"
    ? TEMP_UNAVAILABLE_EN
    : TEMP_UNAVAILABLE_FR;
}

export function rateLimitedAnswer(locale?: string | null): string {
  return resolveLocale(locale) === "en" ? RATE_LIMITED_EN : RATE_LIMITED_FR;
}

export function timeoutAnswer(locale?: string | null): string {
  return resolveLocale(locale) === "en" ? TIMEOUT_EN : TIMEOUT_FR;
}

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= ragConfig.rateLimitPerMin) {
    return false;
  }
  bucket.count += 1;
  return true;
}
