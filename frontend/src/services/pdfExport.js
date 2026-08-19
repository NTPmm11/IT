
import { STATUS_LABEL } from "./constants.js";
import sarabunRegularUrl from "../assets/fonts/Sarabun-Regular.ttf?url";
import sarabunBoldUrl from "../assets/fonts/Sarabun-Bold.ttf?url";

const CHANGE_TYPE_LABEL = { App: "Application / Software", DB: "Database Schema", Infra: "Infrastructure" };
const APPROVAL_RESULT_LABEL = { approved: "อนุมัติ", rejected: "ไม่อนุมัติ", more_info: "ขอข้อมูลเพิ่มเติม" };

const NAVY = [21, 42, 82];
const RULE = [190, 195, 205];

function fmtDate(value) {
  return value ? String(value).slice(0, 10) : "-";
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFontBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return bufferToBase64(buffer);
}

async function buildCrPdf(cr) {
  const [{ jsPDF }, autoTableModule, regularBase64, boldBase64] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadFontBase64(sarabunRegularUrl),
    loadFontBase64(sarabunBoldUrl)
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Sarabun-Regular.ttf", regularBase64);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", boldBase64);
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const usableWidth = pageWidth - marginX * 2;

  const factTable = (body, startY, columnStyles) => {
    autoTable(doc, {
      startY,
      body,
      theme: "plain",
      styles: {
        font: "Sarabun",
        fontStyle: "normal",
        fontSize: 9.5,
        cellPadding: { top: 1.8, bottom: 1.8, left: 0, right: 3 },
        textColor: 20,
        lineColor: RULE,
        lineWidth: { bottom: 0.1 }
      },
      columnStyles,
      margin: { left: marginX, right: marginX }
    });
    return doc.lastAutoTable.finalY;
  };

  const sectionTitle = (title, y) => {
    doc.setFont("Sarabun", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(title, marginX, y);
    doc.setTextColor(20, 20, 20);
    return y + 5;
  };

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);

  doc.rect(pageWidth - marginX - 55, 10, 55, 20);
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(9);
  doc.text("เลขที่เอกสาร", pageWidth - marginX - 50, 16);
  doc.setFont("Sarabun", "normal");
  doc.text(cr.cr_number || "-", pageWidth - marginX - 5, 16, { align: "right" });
  doc.setFont("Sarabun", "bold");
  doc.text("วันที่ร้องขอ", pageWidth - marginX - 50, 23);
  doc.setFont("Sarabun", "normal");
  doc.text(fmtDate(cr.request_date), pageWidth - marginX - 5, 23, { align: "right" });

  doc.setFont("Sarabun", "bold");
  doc.setFontSize(15);
  doc.text("CHANGE REQUEST FORM (CR)", marginX, 18);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(9);
  doc.text("ระบบยื่นคำขออนุมัติการเปลี่ยนแปลงและปรับปรุงระบบงาน", marginX, 25);

  doc.setFontSize(11);
  doc.setFont("Sarabun", "bold");
  doc.text(cr.subject || "-", pageWidth / 2, 34, { align: "center" });

  let y = 42;

  const labelStyle = { fontStyle: "bold", cellWidth: 42 };
  y = factTable(
    [
      ["ผู้ร้องขอ", cr.requester || "-", "แผนก/ฝ่าย", cr.department || "-"],
      ["อีเมล/เบอร์โทร", cr.contact || "-", "ระบบที่เกี่ยวข้อง", cr.system_name || "-"],
      ["ความสำคัญ (Priority)", cr.priority || "-", "สถานะ", STATUS_LABEL[cr.status] || cr.status || "-"]
    ],
    y,
    { 0: labelStyle, 1: { cellWidth: 51 }, 2: labelStyle, 3: { cellWidth: 51 } }
  ) + 6;

  y = sectionTitle("รายละเอียดคำขอ", y);
  y = factTable(
    [
      ["สถานะปัจจุบัน / ปัญหาที่พบ", cr.problem || "-"],
      ["สิ่งที่ต้องการให้ปรับปรุง", cr.request_detail || "-"]
    ],
    y,
    { 0: { fontStyle: "bold", cellWidth: 42, valign: "top" }, 1: { valign: "top" } }
  ) + 6;

  const changeTypesText = (cr.changeTypes || []).length
    ? cr.changeTypes.map(t => CHANGE_TYPE_LABEL[t] || t).join(", ")
    : "-";
  const impactText = cr.impact === "other" ? `กระทบระบบอื่น: ${cr.impact_detail || "-"}` : "ไม่มีผลกระทบส่วนอื่น";

  y = sectionTitle("การประเมินผลกระทบและทรัพยากร", y);
  y = factTable(
    [
      ["ประเภทการเปลี่ยน", changeTypesText, "ผลกระทบระบบ", impactText],
      ["ปิดระบบชั่วคราว (Downtime)", cr.downtime ? "ต้องปิดระบบ" : "ไม่ต้องปิดระบบ", "ระยะเวลาที่คาดใช้", cr.duration || "-"],
      [{ content: "เป้าหมาย Deploy", styles: labelStyle }, { content: fmtDate(cr.deploy_date), colSpan: 3 }]
    ],
    y,
    { 0: labelStyle, 1: { cellWidth: 51 }, 2: labelStyle, 3: { cellWidth: 51 } }
  ) + 6;

  const planTable = (title, rows) => {
    if (!rows || !rows.length) return;
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 15;
    }
    y = sectionTitle(title, y);
    autoTable(doc, {
      startY: y,
      head: [["ลำดับ", "ขั้นตอนงาน", "เริ่ม", "สิ้นสุด", "ผู้รับผิดชอบ", "หมายเหตุ"]],
      body: rows.map((r, i) => [i + 1, r.step || "-", fmtDate(r.start_date), fmtDate(r.end_date), r.owner || "-", r.note || "-"]),
      theme: "grid",
      styles: { font: "Sarabun", fontStyle: "normal", fontSize: 9, cellPadding: 2, textColor: 20, lineColor: [190, 195, 205] },
      headStyles: {
        font: "Sarabun", fontStyle: "bold", halign: "center",
        fillColor: false, textColor: NAVY, lineColor: NAVY, lineWidth: { bottom: 0.5 }
      },
      columnStyles: { 0: { cellWidth: 12, halign: "center" } },
      margin: { left: marginX, right: marginX }
    });
    y = doc.lastAutoTable.finalY + 6;
  };

  planTable("แผนดำเนินงาน (Action Plan)", cr.plan);
  planTable("แผนการกู้คืน (Roll Back Plan)", cr.rollbackPlan);

  const approval =
    (cr.approvals || []).slice().reverse().find(a => a.result === "approved") ||
    (cr.approvals || [])[cr.approvals.length - 1];

  if (approval) {
    doc.setFontSize(10.5);
    const commentLines = doc.splitTextToSize(String(approval.comment || "-"), usableWidth - 40);
    const boxH = 27 + commentLines.length * 5.5;

    if (y > pageHeight - boxH - 10) {
      doc.addPage();
      y = 15;
    }
    doc.setDrawColor(...NAVY);
    doc.rect(marginX, y, usableWidth, boxH);

    doc.setFont("Sarabun", "bold");
    doc.text("ผลการพิจารณา", marginX + 4, y + 7);
    doc.setFont("Sarabun", "normal");
    doc.text(APPROVAL_RESULT_LABEL[approval.result] || approval.result, marginX + 32, y + 7);

    doc.setFont("Sarabun", "bold");
    doc.text("วันที่พิจารณา", marginX + usableWidth - 55, y + 7);
    doc.setFont("Sarabun", "normal");
    doc.text(fmtDate(approval.approval_date), marginX + usableWidth - 4, y + 7, { align: "right" });

    doc.setFont("Sarabun", "bold");
    doc.text("ความเห็น", marginX + 4, y + 14);
    doc.setFont("Sarabun", "normal");
    doc.text(commentLines, marginX + 32, y + 14);

    const signY = y + boxH - 11;
    doc.line(marginX + usableWidth / 2 - 40, signY, marginX + usableWidth / 2 + 40, signY);
    doc.setFontSize(9);
    doc.text("ลงชื่อผู้พิจารณา", marginX + usableWidth / 2, signY + 4.5, { align: "center" });
    doc.text(`(${approval.approver || "-"})`, marginX + usableWidth / 2, signY + 9, { align: "center" });

    y += boxH + 4;
  }

  const pageCount = doc.internal.getNumberOfPages();
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`หน้า ${i}/${pageCount}`, pageWidth - marginX, pageHeight - 6, { align: "right" });
  }

  return doc;
}

export async function buildCrPdfBlobUrl(cr) {
  const doc = await buildCrPdf(cr);
  return URL.createObjectURL(doc.output("blob"));
}

export async function downloadCrPdf(cr) {
  const doc = await buildCrPdf(cr);
  doc.save(`${cr.cr_number || "CR"}.pdf`);
}
