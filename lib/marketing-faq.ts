import { STANDARD_ENDOTOXIN_TEST, centsToDollars } from "./lab/endotoxin-order";

const standardEndotoxinPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: STANDARD_ENDOTOXIN_TEST.currency,
}).format(centsToDollars(STANDARD_ENDOTOXIN_TEST.unitPriceCents));

export const endotoxinFaqs = [
  {
    question: "What is endotoxin, and why is it tested?",
    answer: "Endotoxins are lipopolysaccharides associated with the outer membrane of Gram-negative bacteria. Testing helps researchers assess contamination against the limit established for their material and intended use.",
  },
  {
    question: "What types of samples can be tested?",
    answer: "Typical samples include biologics, cell and gene therapy materials, vaccines, medical-device extracts, raw materials, and water. Each matrix is reviewed for method suitability.",
  },
  {
    question: "Which endotoxin testing method is used?",
    answer: "ClearSignal supports a recombinant Factor C endpoint fluorescence workflow. The laboratory confirms that the method is suitable for the submitted matrix and intended use.",
  },
  {
    question: "How much does Endotoxin cost?",
    answer: `The standard endotoxin test costs ${standardEndotoxinPrice} ${STANDARD_ENDOTOXIN_TEST.currency} per sample.`,
  },
  {
    question: "How much sample do I need to provide?",
    answer: "The required amount depends on the sample matrix, anticipated dilution, controls, and whether repeat testing may be needed. Submit the available quantity and unit so the laboratory can confirm requirements before shipment.",
  },
  {
    question: "How should samples be labeled and prepared?",
    answer: "Give every sample a unique ID and document its matrix, product or lot, process stage, storage condition, and quantity when applicable. Packaging and temperature requirements should be confirmed before shipping.",
  },
  {
    question: "How is sample interference handled?",
    answer: "The laboratory evaluates inhibition or enhancement using appropriate controls and dilution studies. Any dilution must remain within the sample’s maximum valid dilution.",
  },
  {
    question: "What information should accompany my testing request?",
    answer: "Sample names are all that is needed, but you can also add project name, and testing purpose.",
  },
  {
    question: "How long does endotoxin testing take?",
    answer: "3-5 days",
  },
  {
    question: "What information is included with the result?",
    answer: "The result will report endotoxin concentration in endotoxin units per milliliter (EU/mL).",
  },
  {
    question: "Where do I send my samples?",
    answer: "Samples can be sent to 555 Jackson Dr, Baltimore, MD 21208.",
  },
] as const;
