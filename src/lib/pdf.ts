type RenderPdfOptions = {
  filename?: string;
  marginInches?: number;
  scale?: number;
};

export async function renderElementPdfBlob(element: HTMLElement, options: RenderPdfOptions = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const marginInches = options.marginInches ?? 0.35;
  const scale = options.scale ?? 2;

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.98);
  const pdf = new jsPDF({
    unit: "in",
    format: "letter",
    orientation: "portrait",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginInches * 2;
  const contentHeight = pageHeight - marginInches * 2;
  const imageHeight = (canvas.height * contentWidth) / canvas.width;

  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < imageHeight - 0.001) {
    if (pageIndex > 0) pdf.addPage();

    const offsetY = marginInches - renderedHeight;
    pdf.addImage(imgData, "JPEG", marginInches, offsetY, contentWidth, imageHeight, undefined, "FAST");

    renderedHeight += contentHeight;
    pageIndex += 1;
  }

  return pdf.output("blob");
}
