import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // غلق البارسر الافتراضي لـ Vercel للتعامل مع الـ Binary يدوياً
  },
};

export default async function handler(req, res) {
  // السماح لجميع النطاقات بالوصول (حل مشكلة CORS بالكامل)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, detail: 'الطريقة غير مسموح بها' });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, detail: 'خطأ في قراءة الملف على السيرفر' });
    }

    // استخراج الملف المرفوع بشكل صحيح تبعا لنسخة formidable
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    
    if (!uploadedFile) {
      return res.status(400).json({ success: false, detail: 'لم يتم العثور على ملف مرفوع' });
    }

    try {
      // قراءة الملف من المسار المؤقت وتحويله لـ Blob متوافق مع خوادم الـ OCR
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);
      const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });

      // بناء الـ FormData السيرفرية الرسمية لـ OCR.space
      const formData = new FormData();
      formData.append('apikey', 'helloworld'); // استبدله بمفتاحك الخاص لاحقاً لسرعة أعلى
      formData.append('language', 'ara');      
      formData.append('isOverlayRequired', 'true');
      formData.append('isCreateSearchablePdf', 'true');
      formData.append('isSearchablePdfHideTextLayer', 'true');
      formData.append('file', fileBlob, uploadedFile.originalFilename || 'document.pdf');

      // إرسال الطلب من سيرفر Vercel إلى سيرفر OCR.space (هنا لن يظهر خطأ 405 أبداً)
      const ocrResponse = await fetch('https://ocr.space', {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        return res.status(ocrResponse.status).json({ success: false, detail: `خطأ من مزود الخدمة السحابي بترميز: ${ocrResponse.status}` });
      }

      const result = await ocrResponse.json();

      // التحقق من معالجة الملف وإرجاع الرابط للمستخدم
      if (result.OCRExitCode === 1 && result.SearchablePdfURL) {
        // تنظيف الملف المؤقت من السيرفر فوراً لتوفير المساحة
        fs.unlinkSync(uploadedFile.filepath);
        return res.status(200).json({ success: true, download_url: result.SearchablePdfURL });
      } else {
        const errorMsg = result.ErrorMessage ? result.ErrorMessage.toString() : 'فشلت معالجة الـ OCR للملف';
        return res.status(400).json({ success: false, detail: errorMsg });
      }

    } catch (error) {
      return res.status(500).json({ success: false, detail: `خطأ داخلي بالسيرفر: ${error.message}` });
    }
  });
}
