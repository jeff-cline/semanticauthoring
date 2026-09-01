import "server-only";

/** Extract plain text from a PDF, page by page, preserving line breaks. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // The legacy build is the one that runs under Node without a DOM.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const out: string[] = [];
  const max = Math.min(doc.numPages, 60);   // syllabi are short; cap runaway files
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    let lastY: number | null = null;
    for (const item of content.items as any[]) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5];
      // A change in vertical position means a new visual line.
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
        out.push(line.trim());
        line = "";
      }
      line += item.str + (item.hasEOL ? "\n" : " ");
      if (y !== undefined) lastY = y;
    }
    if (line.trim()) out.push(line.trim());
    out.push("");
  }
  await doc.destroy().catch(() => {});
  return out.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}
