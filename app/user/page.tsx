import type { Metadata } from "next";
import { UserDashboard } from "./UserDashboard";

export const metadata: Metadata = { title: "Your workspace | ClearSignal", robots: { index: false, follow: false } };

export default function UserPage() {
  return <UserDashboard />;
}
