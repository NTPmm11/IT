using System.Net;
using System.Text;

namespace ChangeRequest.Api.Services;

public readonly record struct EmailField(string Label, string? Value, bool Raw = false);

public static class EmailRenderer
{
    public static string Escape(string? value) => WebUtility.HtmlEncode(value ?? "");

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
