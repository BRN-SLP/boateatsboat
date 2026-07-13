"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";

// Hides the global navbar on the landing page ("/") where a floating
// overlay nav is rendered inside the hero instead.
export function ConditionalNavbar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <Navbar />;
}
