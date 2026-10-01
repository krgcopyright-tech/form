import type { Registration, AppSettings } from '../types';

export const APPS_SCRIPT_TEMPLATE = `// کۆدی ئامادەکراو بۆ Google Sheets Apps Script
// لە Google Sheets بڕۆ بۆ: Extensions > Apps Script و ئەم کۆدە دابنێ:

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // ئەگەر شیتەکە بەتاڵ بوو، سەردێڕەکان (Headers) زیاد بکە
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "کۆدی تۆمارکردن",
        "ناوی سیانی",
        "ژمارەی مۆبایل",
        "ئیمەیڵی زانکۆ",
        "تێبینی ئیمەیڵی زانکۆ",
        "ئیمەیڵی کەسی",
        "تێبینی ئیمەیڵی کەسی",
        "قۆناغی خوێندن",
        "ژمارەی ناسنامەی قوتابی (ID)",
        "دۆخ",
        "بەرواری تۆمارکردن"
      ]);
      // ڕێکخستنی شێوازی سەردێڕەکان
      var headerRange = sheet.getRange(1, 1, 1, 11);
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }

    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.registration_code || "",
      data.full_name || "",
      "'" + (data.mobile_number || ""), // هێمای ' بۆ ئەوەی سفرەکانی سەرەتای مۆبایل نەسڕێتەوە
      data.university_email || "",
      data.university_email_note || "",
      data.personal_email || "",
      data.personal_email_note || "",
      data.academic_level || "",
      data.student_id || "",
      data.status || "new",
      data.created_at || new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" })
    ]);

    return ContentService.createTextOutput(JSON.stringify({ result: "success", status: 200 }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "active", message: "EPU MIS Google Sheet Webhook is running!" }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

/**
 * Sends a registration directly to Google Sheets Apps Script Web App.
 * Uses mode: 'no-cors' so that the browser does not block Google's 302 redirects.
 */
export async function sendRegistrationToGoogleSheets(
  registration: Registration,
  scriptUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!scriptUrl || !scriptUrl.trim().startsWith('https://script.google.com')) {
    return { success: false, error: 'لینکێکی دروستی Google Apps Script بوونی نییە.' };
  }

  try {
    const payload = JSON.stringify({
      registration_code: registration.registration_code,
      full_name: registration.full_name,
      mobile_number: registration.mobile_number,
      university_email: registration.university_email,
      university_email_note: registration.university_email_note || '',
      personal_email: registration.personal_email,
      personal_email_note: registration.personal_email_note || '',
      academic_level: registration.academic_level,
      student_id: registration.student_id || '',
      status: registration.status,
      created_at: registration.created_at,
    });

    // Send using fetch with no-cors to avoid CORS preflight rejection by Google
    await fetch(scriptUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send to Google Sheets:', err);
    return { success: false, error: err?.message || 'هەڵە لە پەیوەندی بە Google Sheets' };
  }
}

/**
 * Tests connection with Google Sheets URL
 */
export async function testGoogleSheetConnection(scriptUrl: string): Promise<boolean> {
  if (!scriptUrl || !scriptUrl.trim().startsWith('https://script.google.com')) {
    return false;
  }

  try {
    await fetch(scriptUrl.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        registration_code: 'TEST-PING',
        full_name: 'تاقیکردنەوەی سیستەم',
        mobile_number: '07500000000',
        university_email: 'test@epu.edu.iq',
        personal_email: 'test@gmail.com',
        academic_level: 'تاقیکردنەوە',
        status: 'test',
        created_at: new Date().toISOString(),
      }),
    });
    return true;
  } catch (err) {
    return false;
  }
}
