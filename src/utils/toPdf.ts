import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Invoice } from "../models/Invoice";

export const toPdf = async (element: HTMLElement, fileName: string) => {
      console.log("Beginning pdf gen")
      const canvas = await html2canvas(element, {
        scale: 1.75,
        useCORS: true,
        height: element.offsetHeight,
        onclone: function(clonedDoc) {
          // Find all inputs in cloned document and adjust their height
          Array.from(clonedDoc.getElementsByTagName('input')).forEach(input => {
            input.style.height = "24px";
            input.style.padding = "0px";
            input.style.borderRadius = "0px"
          });
        }
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
  
      pdf.addImage(data, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(fileName)
      console.log("Finished generating pdf")
}