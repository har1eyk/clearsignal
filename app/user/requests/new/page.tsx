import type { Metadata } from "next";
import { TestingRequestForm } from "./TestingRequestForm";

export const metadata: Metadata = {
  title: "New testing request | ClearSignal",
  robots: { index: false, follow: false },
};

export default function NewTestingRequestPage() {
  return <TestingRequestForm />;
}
