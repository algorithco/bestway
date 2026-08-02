import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';

const SECTION_LABELS: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

export interface CertificateData {
  studentName: string;
  testTitle: string;
  testType: string;
  level: string | null;
  finishedAt: Date;
  attemptId: string;
  sections: Array<{ section: string; score: number; maxScore: number }>;
  totalScore: number;
  totalMax: number;
}

/** Natija sertifikati PDF (pdfkit — tashqi servissiz) */
@Injectable()
export class CertificateService {
  constructor(private readonly config: ConfigService) {}

  async generate(data: CertificateData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const centerName = this.config.get<string>('CENTER_NAME') ?? "O'quv Markazi";
    const pageW = doc.page.width;

    // Ramka
    doc.rect(30, 30, pageW - 60, doc.page.height - 60).lineWidth(2).stroke('#1a4f8b');
    doc
      .rect(36, 36, pageW - 72, doc.page.height - 72)
      .lineWidth(0.5)
      .stroke('#1a4f8b');

    doc.moveDown(3);
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#1a4f8b').text(centerName, {
      align: 'center',
    });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(14).fillColor('#444').text('NATIJA SERTIFIKATI', {
      align: 'center',
      characterSpacing: 2,
    });

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(11).fillColor('#666').text('Ushbu sertifikat', {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#000').text(data.studentName, {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#666')
      .text('quyidagi testni muvaffaqiyatli topshirgani uchun berildi:', { align: 'center' });
    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#1a4f8b')
      .text(
        `${data.testTitle}${data.level ? ` (${data.level})` : ''} — ${data.testType.toUpperCase()}`,
        { align: 'center' },
      );

    // Bo'limlar jadvali
    doc.moveDown(2);
    const tableX = 160;
    const colScore = tableX + 220;
    let y = doc.y;

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000');
    doc.text("Bo'lim", tableX, y);
    doc.text('Ball', colScore, y);
    y += 8;
    doc
      .moveTo(tableX, y + 10)
      .lineTo(colScore + 60, y + 10)
      .lineWidth(0.5)
      .stroke('#999');
    y += 18;

    doc.font('Helvetica').fontSize(12);
    for (const s of data.sections) {
      doc.text(SECTION_LABELS[s.section] ?? s.section, tableX, y);
      doc.text(`${s.score} / ${s.maxScore}`, colScore, y);
      y += 20;
    }
    y += 6;
    doc
      .moveTo(tableX, y)
      .lineTo(colScore + 60, y)
      .lineWidth(0.5)
      .stroke('#999');
    y += 10;
    doc.font('Helvetica-Bold').fontSize(13);
    doc.text('JAMI', tableX, y);
    doc.text(`${data.totalScore} / ${data.totalMax}`, colScore, y);

    // Pastki qism
    const bottomY = doc.page.height - 110;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#444')
      .text(`Sana: ${data.finishedAt.toISOString().slice(0, 10)}`, 60, bottomY);
    doc
      .fontSize(8)
      .fillColor('#888')
      .text(`Sertifikat ID: ${data.attemptId}`, 60, bottomY + 16);
    doc
      .fontSize(8)
      .fillColor('#888')
      .text(
        'Ushbu hujjat markaz administratsiyasi tomonidan tasdiqlangan taqdirda haqiqiy hisoblanadi.',
        60,
        bottomY + 32,
        { width: pageW - 120 },
      );

    doc.end();
    return done;
  }
}
