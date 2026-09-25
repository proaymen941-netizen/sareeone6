import { GUIDE_CATEGORIES, GUIDE_TASKS, GuideTask } from '@/data/adminGuideData';

interface GenerateGuidePDFOptions {
  tasks?: GuideTask[];
  title?: string;
  appName?: string;
  logoUrl?: string;
}

export async function generateGuidePDF(options: GenerateGuidePDFOptions = {}): Promise<void> {
  const {
    tasks = GUIDE_TASKS,
    title = 'دليل الشامل لإدارة النظام ولائحة العمليات',
    appName = 'سريع ون (Saree One)',
    logoUrl = ''
  } = options;

  // Group tasks by category
  const categoriesMap = new Map<string, GuideTask[]>();
  tasks.forEach(task => {
    const cat = GUIDE_CATEGORIES.find(c => c.id === task.category)?.title || 'أخرى';
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat)!.push(task);
  });

  const currentDate = new Date().toLocaleDateString('ar-YE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Construct styled printable HTML structure
  let categoriesHTML = '';
  let taskCounter = 1;

  categoriesMap.forEach((categoryTasks, categoryName) => {
    const tasksHTML = categoryTasks.map(task => {
      const num = taskCounter++;
      const stepsList = task.steps.map((step, idx) => `
        <li style="margin-bottom: 6px; line-height: 1.6; font-size: 13px; color: #334155;">
          <span style="display:inline-block; font-weight:bold; color:#0284c7; margin-left:4px;">${idx + 1}.</span> ${step}
        </li>
      `).join('');

      const tipsHTML = task.tips && task.tips.length > 0 ? `
        <div style="background-color: #fffbebf5; border-right: 4px solid #f59e0b; padding: 10px 14px; border-radius: 6px; margin-top: 10px;">
          <strong style="color: #b45309; font-size: 12px; display: block; margin-bottom: 4px;">💡 نصائح وإرشادات:</strong>
          ${task.tips.map(tip => `<p style="font-size: 12px; color: #78350f; margin: 0; line-height: 1.5;">• ${tip}</p>`).join('')}
        </div>
      ` : '';

      return `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 18px; page-break-inside: avoid; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px;">
            <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span style="background: #0284c7; color: white; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">${num}</span>
              ${task.title}
            </h3>
            <span style="background: #f1f5f9; color: #475569; font-size: 11px; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${task.location}</span>
          </div>

          <p style="font-size: 13px; color: #475569; margin: 0 0 12px 0; line-height: 1.6; background: #f8fafc; padding: 8px 12px; border-radius: 6px;">
            ${task.description}
          </p>

          <div style="margin-top: 10px;">
            <strong style="font-size: 13px; color: #0f172a; display: block; margin-bottom: 6px; border-right: 3px solid #0284c7; padding-right: 8px;">خطوات التنفيذ:</strong>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${stepsList}
            </ul>
          </div>

          ${tipsHTML}
        </div>
      `;
    }).join('');

    categoriesHTML += `
      <div style="margin-top: 28px; page-break-before: auto;">
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 12px 18px; border-radius: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 17px; font-weight: bold; margin: 0;">📂 ${categoryName}</h2>
          <span style="background: rgba(255,255,255,0.15); font-size: 12px; padding: 3px 10px; border-radius: 12px;">${categoryTasks.length} وظيفة / مهمة</span>
        </div>
        ${tasksHTML}
      </div>
    `;
  });

  const fullHTML = `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
      
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f8fafc;
        color: #0f172a;
        margin: 0;
        padding: 24px;
        direction: rtl;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .container {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        padding: 32px;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      }

      .header {
        border-bottom: 3px solid #0284c7;
        padding-bottom: 20px;
        margin-bottom: 28px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-title {
        font-size: 24px;
        font-weight: 800;
        color: #0284c7;
        margin: 0 0 6px 0;
      }

      .header-subtitle {
        font-size: 14px;
        color: #64748b;
        margin: 0;
      }

      .index-box {
        background: #f1f5f9;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 24px;
      }

      .index-title {
        font-size: 15px;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 10px 0;
      }

      .index-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .index-item {
        font-size: 12px;
        color: #334155;
        background: white;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
      }

      @media print {
        body {
          background: white;
          padding: 0;
        }
        .container {
          box-shadow: none;
          padding: 0;
          max-width: 100%;
        }
        .no-print {
          display: none !important;
        }
        .page-break {
          page-break-before: always;
        }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="position: fixed; top: 16px; left: 16px; z-index: 9999; display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
        🖨️ طباعة / حفظ PDF
      </button>
      <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px;">
        إغلاق
      </button>
    </div>

    <div class="container">
      <div class="header">
        <div>
          <h1 class="header-title">${title}</h1>
          <p class="header-subtitle">نظام إدارة ${appName} — دليل المشغل ولوحة التحكم الرسمية</p>
        </div>
        <div style="text-align: left;">
          ${logoUrl ? `<img src="${logoUrl}" style="height: 50px; object-fit: contain; margin-bottom: 6px;" />` : `<div style="background: #0284c7; color: white; font-weight: 900; padding: 8px 16px; border-radius: 8px; font-size: 18px;">سريع</div>`}
          <div style="font-size: 11px; color: #94a3b8;">التاريخ: ${currentDate}</div>
        </div>
      </div>

      <div class="index-box">
        <h3 class="index-title">📌 فهرس المحتويات والمهام المتاحة</h3>
        <div class="index-grid">
          ${GUIDE_CATEGORIES.map(cat => {
            const count = tasks.filter(t => t.category === cat.id).length;
            return `<div class="index-item"><strong>${cat.title}</strong> (${count} عملية)</div>`;
          }).join('')}
        </div>
      </div>

      ${categoriesHTML}

      <div style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
        تم توليد هذا الدليل تلقائياً من لوحة تحكم نظام ${appName} — جميع الحقوق محفوظة © ${new Date().getFullYear()}
      </div>
    </div>
  </body>
  </html>
  `;

  // Open formatted window for printing or high-quality browser PDF save
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(fullHTML);
    printWindow.document.close();
    printWindow.focus();
  } else {
    // Fallback: Use jsPDF + html2canvas for direct download if popups are blocked
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed; top:-9999px; left:-9999px; width:800px; z-index:-9999;';
      wrapper.innerHTML = fullHTML;
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('System_User_Manual.pdf');
      document.body.removeChild(wrapper);
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  }
}
