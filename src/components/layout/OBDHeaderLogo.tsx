"use client";

import { useState } from "react";
import Image from "next/image";

const OBD_LOGO_URL =
  "https://ocalabusinessdirectory.com/wp-content/uploads/2025/12/OBD-Business-Suite-Logo.png";

export default function OBDHeaderLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-label="OBD"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-xs font-semibold tracking-wide text-teal-200"
      >
        OBD
      </span>
    );
  }

  return (
    <Image
      src={OBD_LOGO_URL}
      alt="Ocala Business Directory"
      width={320}
      height={80}
      className="h-10 w-auto"
      priority
      onError={() => setFailed(true)}
    />
  );
}

