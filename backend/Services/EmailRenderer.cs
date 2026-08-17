using System.Net;
using System.Text;

namespace ChangeRequest.Api.Services;

// ============================================
// EmailRenderer — ประกอบ HTML ของอีเมลแจ้งเตือน
// ============================================
//
// หน้าตาแบบ "ใบเอกสาร" ให้เข้าธีมกับฟอร์มจริงในเว็บ ไม่ใช่การ์ด SaaS ทั่วไป
// inline CSS ทั้งหมด — mail client ส่วนใหญ่ตัด <style> ทิ้ง
//
// สี/ฟอนต์/เลย์เอาต์ยกมาจาก frontend/src/assets/css จริง:
//   letterhead (เส้นคั่นล่างหนา จัดกลาง)  = .header-section
//   field label:value 2 คอลัมน์            = .form-group
//   navy #00075a / maroon #5a0000          = สีหลักของเว็บ
//   ปุ่ม pill navy                          = .btn-submit

/// <summary>1 แถว label:value ในอีเมล</summary>
/// <param name="Label">หัวข้อคอลัมน์ซ้าย</param>
/// <param name="Value">ค่าคอลัมน์ขวา</param>
/// <param name="Raw">true = แปะ HTML ตรงๆ ไม่ escape (ใช้เฉพาะค่าที่ backend สร้างเอง)</param>
public readonly record struct EmailField(string Label, string? Value, bool Raw = false);

public static class EmailRenderer
{
    public static string Escape(string? value) => WebUtility.HtmlEncode(value ?? "");

    /// <param name="heading">หัวเรื่องของอีเมลนี้</param>
    /// <param name="fields">แถว label:value — Value ถูก escape ให้อัตโนมัติเว้นแต่ Raw = true</param>
    /// <param name="statusText">ผลพิจารณา (ข้อความตัวหนาสีเดียว ไม่ทำ badge — เอกสารทางการไม่ใช้)</param>
    /// <param name="statusColor">สีของ statusText</param>
    /// <param name="ctaText">ข้อความบนปุ่มลิงก์ (ใส่ก็ได้ไม่ใส่ก็ได้)</param>
    /// <param name="ctaUrl">ปลายทางของปุ่มลิงก์</param>
    public static string Render(
        string heading,
        IEnumerable<EmailField>? fields = null,
        string? statusText = null,
        string? statusColor = null,
        string? ctaText = null,
        string? ctaUrl = null)
    {
        var rows = new StringBuilder();
        foreach (var field in fields ?? [])
        {
            var value = field.Raw ? field.Value ?? "" : Escape(field.Value);
            rows.Append($"""

                    <tr>
                      <td style="padding:9px 16px 9px 0;width:110px;font-size:13.5px;font-weight:600;color:#000000;vertical-align:top;white-space:nowrap;">{Escape(field.Label)}</td>
                      <td style="padding:9px 0;font-size:14px;color:#3b3b3b;line-height:1.6;">{value}</td>
                    </tr>
                """);
        }

        var statusBlock = string.IsNullOrEmpty(statusText)
            ? ""
            : $"""<div style="font-size:14px;font-weight:700;color:{Escape(statusColor)};margin-top:6px;">{Escape(statusText)}</div>""";

        var ctaBlock = string.IsNullOrEmpty(ctaUrl)
            ? ""
            : $"""
              <tr>
                <td style="padding:22px 32px 8px;">
                  <a href="{Escape(ctaUrl)}" style="display:inline-block;background:#00075a;color:#ffffff;text-decoration:none;padding:11px 26px;border-radius:50px;font-size:14px;font-weight:600;">{Escape(ctaText)}</a>
                </td>
              </tr>
            """;

        return $"""
          <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f5f7;padding:32px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
              <tr>
                <td style="text-align:center;border-bottom:3px solid #00075a;padding:26px 32px 20px;">
                  <div style="font-size:12px;letter-spacing:1px;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">ระบบขออนุมัติเปลี่ยนแปลงระบบงาน</div>
                  <div style="font-size:20px;font-weight:800;color:#00112c;">CR System</div>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 32px 4px;">
                  <div style="font-size:16px;font-weight:700;color:#00112c;">{Escape(heading)}</div>
                  {statusBlock}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 32px 4px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
                    {rows}
                  </table>
                </td>
              </tr>
              {ctaBlock}
              <tr>
                <td style="padding:24px 32px 22px;border-top:2px dashed #e5e7eb;">
                  <span style="font-size:11.5px;color:#9ca3af;">อีเมลนี้ส่งอัตโนมัติจากระบบ CR System กรุณาอย่าตอบกลับ</span>
                </td>
              </tr>
            </table>
          </div>
        """;
    }
}
