import { STANDARD_ENDOTOXIN_TEST, centsToDollars } from "./lab/endotoxin-order";

const standardEndotoxinPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: STANDARD_ENDOTOXIN_TEST.currency,
}).format(centsToDollars(STANDARD_ENDOTOXIN_TEST.unitPriceCents));

export const endotoxinFaqs = [
  {
    question: "What is endotoxin, and why is it tested?",
    answer: "Endotoxins are lipopolysaccharides associated with the outer membrane of Gram-negative bacteria. Testing helps researchers assess contamination against the limit established for their material and intended use.",
    aliases: ["what is endotoxin", "why test endotoxin", "endotoxin definition", "endotoxin contamination"],
  },
  {
    question: "What types of samples can be tested?",
    answer: "Typical samples include biologics, cell and gene therapy materials, vaccines, medical-device extracts, raw materials, and water. Each matrix is reviewed for method suitability.",
    aliases: ["sample types", "what can be tested", "testable materials", "sample matrices", "can you test biologics vaccines or medical devices"],
  },
  {
    question: "Which endotoxin testing method is used?",
    answer: "ClearSignal supports a recombinant Factor C endpoint fluorescence workflow. The laboratory confirms that the method is suitable for the submitted matrix and intended use.",
    aliases: ["testing method", "assay method", "recombinant factor c", "rfc method", "endpoint fluorescence"],
  },
  {
    question: "How much does Endotoxin cost?",
    answer: `The standard endotoxin test costs ${standardEndotoxinPrice} ${STANDARD_ENDOTOXIN_TEST.currency} per sample.`,
    aliases: ["endotoxin cost", "endotoxin price", "pricing", "testing fee", "what is the price per sample"],
  },
  {
    question: "How much sample do I need to provide?",
    answer: "The required amount depends on the sample matrix, anticipated dilution, controls, and whether repeat testing may be needed. Submit the available quantity and unit so the laboratory can confirm requirements before shipment.",
    aliases: ["sample volume", "sample amount", "how much sample", "quantity required", "sample requirement"],
  },
  {
    question: "How should samples be labeled and prepared?",
    answer: "Give every sample a unique ID and document its matrix, product or lot, process stage, storage condition, and quantity when applicable. Packaging and temperature requirements should be confirmed before shipping.",
    aliases: ["prepare samples", "label samples", "sample preparation", "sample packaging", "storage and temperature requirements"],
  },
  {
    question: "How is sample interference handled?",
    answer: "The laboratory evaluates inhibition or enhancement using appropriate controls and dilution studies. Any dilution must remain within the sample’s maximum valid dilution.",
    aliases: ["sample interference", "matrix interference", "inhibition or enhancement", "maximum valid dilution", "mvd"],
  },
  {
    question: "What information should accompany my testing request?",
    answer: "Sample names are all that is needed, but you can also add project name, and testing purpose.",
    aliases: ["testing request requirements", "what information is needed", "sample information", "sample names", "project name and testing purpose", "request details"],
  },
  {
    question: "How long does endotoxin testing take?",
    answer: "3-5 days",
    aliases: ["turnaround time", "testing timing", "how long", "how quickly will i receive results", "days to receive results"],
  },
  {
    question: "What information is included with the result?",
    answer: "The result will report endotoxin concentration in endotoxin units per milliliter (EU/mL).",
    aliases: ["result information", "what results include", "result report", "eu ml", "endotoxin concentration"],
  },
  {
    question: "Where do I send my samples?",
    answer: "Samples can be sent to 555 Jackson Dr, Baltimore, MD 21208.",
    aliases: ["send samples", "ship samples", "shipping address", "where to send samples", "delivery address"],
  },
] as const;

export type EndotoxinFaq = (typeof endotoxinFaqs)[number];

export type PublishedEndotoxinFaq = Pick<EndotoxinFaq, "question" | "answer">;

export type EndotoxinFaqResponse =
  | { status: "catalog"; count: number; faqs: PublishedEndotoxinFaq[] }
  | { status: "matched"; query: string; question: string; answer: string }
  | {
      status: "no_match";
      query: string;
      answer: null;
      message: string;
      available_questions: string[];
    };

const MEANINGLESS_WORDS = new Set([
  "a", "about", "an", "and", "are", "be", "can", "do", "does", "for", "how", "i", "in", "is", "it", "my", "of",
  "on", "or", "should", "the", "to", "we", "what", "when", "where", "which", "why", "will", "with", "you", "your",
]);

function singularize(word: string) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize)
    .join(" ");
}

function meaningfulTokens(value: string) {
  return new Set(normalize(value).split(" ").filter((word) => word.length > 1 && !MEANINGLESS_WORDS.has(word)));
}

function publishedFaqs(): PublishedEndotoxinFaq[] {
  return endotoxinFaqs.map(({ question, answer }) => ({ question, answer }));
}

const FAQ_SEARCH_INDEX = endotoxinFaqs.map((faq) => ({
  faq,
  exact: new Set([faq.question, ...faq.aliases].map(normalize)),
  tokens: meaningfulTokens([faq.question, ...faq.aliases].join(" ")),
}));

const NO_MATCH_MESSAGE = "ClearSignal has no published FAQ answer for this question.";

export function getEndotoxinFaqResponse(rawQuestion?: unknown): EndotoxinFaqResponse {
  if (rawQuestion === undefined || rawQuestion === null || rawQuestion === "") {
    const faqs = publishedFaqs();
    return { status: "catalog", count: faqs.length, faqs };
  }

  const query = typeof rawQuestion === "string" ? rawQuestion.trim() : String(rawQuestion).trim();
  if (query.length < 2 || query.length > 500) {
    return {
      status: "no_match",
      query,
      answer: null,
      message: NO_MATCH_MESSAGE,
      available_questions: endotoxinFaqs.map(({ question }) => question),
    };
  }

  const normalizedQuery = normalize(query);
  const exactMatch = FAQ_SEARCH_INDEX.find(({ exact }) => exact.has(normalizedQuery));
  if (exactMatch) {
    return {
      status: "matched",
      query,
      question: exactMatch.faq.question,
      answer: exactMatch.faq.answer,
    };
  }

  const queryTokens = meaningfulTokens(query);
  let bestMatch: (typeof FAQ_SEARCH_INDEX)[number] | undefined;
  let bestScore = 1;
  for (const candidate of FAQ_SEARCH_INDEX) {
    let score = 0;
    for (const token of queryTokens) {
      if (candidate.tokens.has(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch) {
    return {
      status: "matched",
      query,
      question: bestMatch.faq.question,
      answer: bestMatch.faq.answer,
    };
  }

  return {
    status: "no_match",
    query,
    answer: null,
    message: NO_MATCH_MESSAGE,
    available_questions: endotoxinFaqs.map(({ question }) => question),
  };
}
