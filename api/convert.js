import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // نغلق الـ body parser الافتراضي لكي نتمكن من قراءة الملفات المرفوعة الكبيرة
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'الطريقة غير مسموح بها' });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, detail: 'خطأ في قراءة الملف المرفوع' });
    }

    const uploadedFile = files.file?.[0] || files.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, detail: 'لم يتم العثور على ملف' });
    }

    try {
      // قراءة الملف وتحويله إلى Buffer لإرساله سحابياً
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);
      
      // تجهيز الـ FormData لإرسالها للـ API
      const formData = new FormData();
      formData.append('apikey', 'helloworld'); // استبدله بمفتاحك الخاص لاحقاً من ocr.space للحصول على سرعة أعلى
      formData.append('language', 'ara');      // يدعم 'ara' للعربية و 'eng' للإنجليزية
      formData.append('isOverlayRequired', 'true');
      formData.append('isCreateSearchablePdf', 'true');
      formData.append('isSearchablePdfHideTextLayer', 'true');

      // تحويل الـ Buffer إلى Blob ليتوافق مع الـ FormData في الـ Node environment
      const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', fileBlob, uploadedFile.originalFilename);

      // إرسال الملف إلى الخادم السحابي لمعالجته عبر الـ OCR
      const ocrResponse = await fetch('https://ocr.space', {
        method: 'POST',
        body: formData,
      });

      const result = await ocrResponse.json();

      if (result.OCRExitCode === 1 && result.SearchablePdfURL) {
        // نرسل رابط التحميل المباشر للـ Frontend
        return res.status(200).json({ success: true, download_url: result.SearchablePdfURL });
      } else {
        const errorMsg = result.ErrorMessage ? result.ErrorMessage[0] : 'فشلت معالجة الـ OCR للملف';
        return res.status(400).json({ success: false, detail: errorMsg });
      }

    } catch (error) {
      return res.status(500).json({ success: false, detail: `خطأ داخلي: ${error.message}` });
    }
  });
}
