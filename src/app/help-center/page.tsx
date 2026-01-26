import type { Metadata } from "next";
import HelpCenterClient from "./HelpCenterClient";

export const metadata: Metadata = {
  title: "OBD Premium Help Center",
  description: "Search across OBD tools to find answers, explanations, and guidance.",
};

export default function HelpCenterPage() {
  return <HelpCenterClient />;
}

