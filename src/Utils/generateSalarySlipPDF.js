import puppeteer from "puppeteer";
import { salarySlipTemplate } from "../constants/salarySlipTemplate.js";
export const generateSalarySlipPDF = async (record) => {
  console.log("✅ SalarySlip PDF start");

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  console.log("✅ New page created");

  await page.setContent(salarySlipTemplate(record), {
    waitUntil: "networkidle0",
  });
  console.log("✅ Content loaded");

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  console.log("✅ Fonts ready");

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });

  console.log("✅ PDF generated size:", pdf.length);

  await browser.close();
  console.log("✅ Browser closed");

  return pdf;
};

