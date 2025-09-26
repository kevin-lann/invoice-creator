import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const toPdf = async (element: HTMLElement, fileName: string) => {
      console.log("Beginning pdf gen")
      const canvas = await html2canvas(element, {
        scale: 1.75,
        useCORS: true,
        height: element.offsetHeight,
        width: element.offsetWidth,
        logging: true, 
        onclone: function(clonedDoc) {
          // Find all inputs in cloned document and adjust their height
          Array.from(clonedDoc.getElementsByTagName('input')).forEach(input => {
            if (input.id === 'invoiceNo') {
              input.style.marginTop = '10px';
            }
            input.style.height = "32px";
            input.style.padding = "0px";
            input.style.borderRadius = "0px";
            input.style.border = "none";
            input.style.background = "none";
          });
          Array.from(clonedDoc.getElementsByClassName("label-padded")).forEach((el) => {
            (el as HTMLDivElement).style.paddingRight = "0px";
          })
          // Handle textareas with proper text wrapping
          Array.from(clonedDoc.getElementsByTagName("textarea")).forEach(ta => {
            // Preserve line breaks and wrapping
            ta.style.whiteSpace = "pre-wrap";
            ta.style.wordBreak = "break-word";
            ta.style.overflowWrap = "break-word";
            ta.style.lineHeight = "1.5";
            ta.style.minHeight = "32px";
            // Force the textarea to show its full content
            ta.style.height = "auto";
            ta.style.height = `${ta.scrollHeight}px`;
            // Remove borders and styling that might interfere
            ta.style.border = "none";
            ta.style.outline = "none";
            ta.style.resize = "none";
            ta.style.overflow = "hidden";
          });
        },
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      })
      const data = canvas.toDataURL("image/png")
  
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: "a4",
      })
  
      const imgProperties = pdf.getImageProperties(data)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProperties.height * pdfWidth)  / imgProperties.width; // scale image
      const pageHeight = pdf.internal.pageSize.getHeight();
  
      // Handle multi-page
      let heightLeft = pdfHeight;
      let position = 0;
      let page = 1;
    
      // First page
      pdf.addImage(data, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    
      // Add subsequent pages if needed
      while (heightLeft >= 0) {
        position = -pageHeight * page;
        pdf.addPage();
        pdf.addImage(data, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
        page++;
      }
    
      pdf.save(fileName);
      console.log("Finished generating pdf");
}