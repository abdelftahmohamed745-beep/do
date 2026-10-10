const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const filesToInclude = [
  'README.md',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'metadata.json',
  '.env.example',
  'firestore.rules',
  'storage.rules',
  'server.ts',
  'index.html',
  'public/firebase-messaging-sw.js',
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'src/types.ts',
  'src/firebase/config.ts',
  'src/services/firebaseService.ts',
  'src/services/securityService.ts',
  'src/services/fcmService.ts',
  'src/services/cloudFunctionsTemplate.ts',
  'src/utils/audio.ts',
  'src/components/AdminDashboard.tsx',
  'src/components/AuthPage.tsx',
  'src/components/ClinicProfilePage.tsx',
  'src/components/CustomWebsiteSection.tsx',
  'src/components/DoctorDashboard.tsx',
  'src/components/DoctorsDirectory.tsx',
  'src/components/FloatingWhatsApp.tsx',
  'src/components/Navbar.tsx',
  'src/components/NotificationSettingsModal.tsx',
  'src/components/PatientBooking.tsx',
  'src/components/PatientTicket.tsx',
  'src/components/QRModal.tsx',
  'src/components/QRScannerModal.tsx',
  'src/components/SettingsModal.tsx',
  'src/components/SubscriptionPage.tsx',
  'src/components/Toast.tsx'
];

async function generatePDF() {
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, 'dawry_project_source_code.pdf');
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4'
  });

  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Title Page / Cover
  doc.fontSize(22).fillColor('#0284c7').text('Dawry Project Source Code - PDF Documentation', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor('#334155').text('Complete Source Code Bundle', { align: 'center' });
  doc.moveDown(1.5);

  doc.rect(40, doc.y, 515, 90).fillAndStroke('#f0f9ff', '#0284c7');
  doc.moveUp(1.8);
  doc.fontSize(11).fillColor('#0369a1').text('NOTICE / تنبيه هام:', { align: 'right' });
  doc.fontSize(9).fillColor('#1e293b').text(
    'This PDF document is for READING & CODE REVIEW ONLY. It contains the complete source code of all files in the project.\n' +
    'To run, edit, or build this project, please export the project as a ZIP archive using the AI Studio settings menu (Export Project ZIP).',
    { align: 'left' }
  );
  doc.moveDown(2);

  doc.fontSize(12).fillColor('#0f172a').text(`Total Included Files: ${filesToInclude.length}`);
  doc.moveDown(1);

  // Table of contents / File list
  doc.fontSize(11).fillColor('#0284c7').text('Files List:');
  doc.fontSize(9).fillColor('#475569');
  filesToInclude.forEach((file, index) => {
    doc.text(`${index + 1}. ${file}`);
  });

  doc.addPage();

  // Add each file content
  for (const relativePath of filesToInclude) {
    const fullPath = path.join(__dirname, '..', relativePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${relativePath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Section Header
    doc.fontSize(14).fillColor('#0284c7').text(`FILE: ${relativePath}`, { underline: true });
    doc.moveDown(0.5);

    // File Content in Courier / Monospace style
    doc.fontSize(8.5).font('Courier').fillColor('#0f172a');
    
    // Split lines to fit cleanly
    const lines = content.split('\n');
    lines.forEach(line => {
      // Chunk long lines to prevent overflow
      if (line.length > 110) {
        for (let i = 0; i < line.length; i += 110) {
          doc.text(line.substring(i, i + 110));
        }
      } else {
        doc.text(line || ' ');
      }
    });

    doc.font('Helvetica'); // Reset font
    doc.moveDown(1.5);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1.5);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log(`PDF successfully generated at: ${outputPath}`);
      resolve();
    });
    writeStream.on('error', reject);
  });
}

generatePDF().catch(console.error);
