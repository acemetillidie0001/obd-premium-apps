export function parseTwilioForm(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody);
  const out: Record<string, string> = {};

  params.forEach((value, key) => {
    out[key] = value;
  });

  return out;
}

