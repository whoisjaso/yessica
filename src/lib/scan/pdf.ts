import { PDFDocument } from "pdf-lib";

/** Letter, in points. Every page is fitted onto it, centred, as a copier would. */
const LETTER = { width: 612, height: 792 };

/** JPEG pages into one PDF, the shape webDEALER's document upload takes. */
export async function pagesToPdf(pages: Blob[], title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("Title Desk");
  for (const blob of pages) {
    const image = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const landscape = image.width > image.height;
    const size = landscape ? { width: LETTER.height, height: LETTER.width } : LETTER;
    const page = pdf.addPage([size.width, size.height]);
    const margin = 18;
    const k = Math.min((size.width - margin * 2) / image.width, (size.height - margin * 2) / image.height);
    const w = image.width * k;
    const h = image.height * k;
    page.drawImage(image, { x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h });
  }
  return pdf.save();
}

/** "02 Title - Alex Sample.pdf": numbered in upload order, safe for any phone's files. */
export function scanFileName(order: number, label: string, buyer: string): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${String(order).padStart(2, "0")} ${clean(label)}${buyer ? ` - ${clean(buyer)}` : ""}.pdf`;
}

/**
 * Hand files to her: the phone's share sheet (Save to Files, AirDrop,
 * email) where there is one, a download where there is not.
 */
export async function shareFiles(files: File[]): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files });
      return;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
