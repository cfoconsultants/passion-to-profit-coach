import { CALENDLY_URL } from './coachScript';
import { LOGO_PNG_BASE64, LOGO_ASPECT } from './logoData';

const INK = [46, 6, 73];
const INK_SOFT = [91, 58, 120];
const ACCENT = [162, 1, 119];
const ACCENT_SOFT = [243, 217, 234];
const LINE = [220, 212, 226];
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function generateRoadmapPdf(r) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  let y = MARGIN;

  function newPage() {
    doc.addPage();
    y = MARGIN;
  }
  function ensureSpace(h) {
    if (y + h > PAGE_H - MARGIN - 24) newPage();
  }
  function setColor(c) {
    doc.setTextColor(c[0], c[1], c[2]);
  }
  function heading(text, size = 13) {
    ensureSpace(size + 14);
    doc.setFont('times', 'bold');
    doc.setFontSize(size);
    setColor(ACCENT);
    doc.text(text, MARGIN, y);
    y += 6;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += size * 0.9;
  }
  function paragraph(text, { size = 10.5, color = INK, font = 'helvetica', style = 'normal', gap = 12 } = {}) {
    doc.setFont(font, style);
    doc.setFontSize(size);
    setColor(color);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    ensureSpace(lines.length * (size * 1.35));
    lines.forEach((line) => {
      doc.text(line, MARGIN, y);
      y += size * 1.35;
    });
    y += gap;
  }
  function bulletList(items, prefix = '•') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    setColor(INK);
    items.forEach((item) => {
      const lines = doc.splitTextToSize(item, CONTENT_W - 16);
      ensureSpace(lines.length * 14);
      doc.text(prefix, MARGIN, y);
      lines.forEach((line) => {
        doc.text(line, MARGIN + 14, y);
        y += 14;
      });
    });
    y += 8;
  }
  function gaugeBar(label, score) {
    ensureSpace(22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setColor(INK_SOFT);
    doc.text(label, MARGIN, y);
    doc.text(score + '/20', PAGE_W - MARGIN, y, { align: 'right' });
    y += 6;
    doc.setFillColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(MARGIN, y, CONTENT_W, 6, 3, 3, 'F');
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.roundedRect(MARGIN, y, CONTENT_W * (score / 20), 6, 3, 3, 'F');
    y += 18;
  }

  // ---------- COVER ----------
  const logoW = 230;
  const logoH = logoW * LOGO_ASPECT;
  doc.addImage(LOGO_PNG_BASE64, 'PNG', (PAGE_W - logoW) / 2, y, logoW, logoH);
  y += logoH + 22;

  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  setColor(INK);
  doc.text('Your Passion to Profit Roadmap', PAGE_W / 2, y, { align: 'center' });
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(INK);
  doc.text(`Prepared for ${r.user_name || 'You'}`, PAGE_W / 2, y, { align: 'center' });
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(INK_SOFT);
  doc.text(
    new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    PAGE_W / 2,
    y,
    { align: 'center' }
  );
  y += 38;

  const total = r.passion_clarity + r.strength_confidence + r.service_alignment + r.business_readiness + r.action_readiness;
  doc.setFont('times', 'bold');
  doc.setFontSize(40);
  setColor(ACCENT);
  doc.text(String(Math.round((total / 100) * 100)), PAGE_W / 2, y, { align: 'center' });
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(INK_SOFT);
  doc.text('PURPOSE SCORE OUT OF 100', PAGE_W / 2, y, { align: 'center' });
  y += 30;

  gaugeBar('Passion clarity', r.passion_clarity);
  gaugeBar('Strength confidence', r.strength_confidence);
  gaugeBar('Service alignment', r.service_alignment);
  gaugeBar('Business readiness', r.business_readiness);
  gaugeBar('Action readiness', r.action_readiness);
  y += 10;
  paragraph(r.reflection, { style: 'italic' });

  // ---------- CONTENT ----------
  newPage();
  heading('Suggested Niche');
  paragraph(r.niche_idea);
  heading('Mission Statement');
  paragraph(r.mission_statement, { style: 'italic' });
  heading('Business Name Ideas');
  paragraph(r.business_names.join('   ·   '), { color: ACCENT, style: 'bold' });

  heading('Business Ideas to Explore');
  r.business_ideas.forEach((b, i) => {
    ensureSpace(52);
    doc.setFont('times', 'bold');
    doc.setFontSize(11.5);
    setColor(INK);
    doc.text(b.name, MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setColor(INK_SOFT);
    [
      `Ideal client: ${b.ideal_client}`,
      `Signature offer: ${b.signature_offer}`,
      `Income potential: ${b.income_potential}   ·   Difficulty: ${b.difficulty}`,
    ].forEach((line) => {
      const wrapped = doc.splitTextToSize(line, CONTENT_W);
      ensureSpace(wrapped.length * 12.5);
      wrapped.forEach((l) => {
        doc.text(l, MARGIN, y);
        y += 12.5;
      });
    });
    if (i < r.business_ideas.length - 1) {
      y += 4;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 12;
    }
  });
  y += 10;

  heading('Marketing Strategy');
  paragraph(r.marketing_strategy);
  heading('YouTube Video Ideas');
  bulletList(r.youtube_ideas, '▶');
  heading('Content & Social Post Ideas');
  bulletList(r.social_post_ideas);
  heading('Lead Magnet Ideas');
  bulletList(r.lead_magnet_ideas);

  heading('30-Day Launch Plan');
  r.launch_plan.forEach((w) => {
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setColor(INK);
    doc.text(`${w.week}: ${w.focus}`, MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setColor(INK_SOFT);
    w.actions.forEach((a) => {
      const wrapped = doc.splitTextToSize('– ' + a, CONTENT_W - 10);
      ensureSpace(wrapped.length * 12.5);
      wrapped.forEach((l) => {
        doc.text(l, MARGIN + 10, y);
        y += 12.5;
      });
    });
    y += 8;
  });

  heading('Your First Step');
  paragraph(r.first_step, { style: 'italic' });

  // ---------- CTA ----------
  ensureSpace(110);
  doc.setFillColor(ACCENT_SOFT[0], ACCENT_SOFT[1], ACCENT_SOFT[2]);
  doc.roundedRect(MARGIN, y, CONTENT_W, 100, 8, 8, 'F');
  y += 24;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  setColor(ACCENT);
  doc.text('Ready to bring this to life?', MARGIN + 16, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(INK);
  const ctaLines = doc.splitTextToSize(
    'Book a free 30-minute discovery call with Onyx Jones to turn one of these ideas into something real.',
    CONTENT_W - 32
  );
  ctaLines.forEach((l) => {
    doc.text(l, MARGIN + 16, y);
    y += 13;
  });
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setColor(ACCENT);
  doc.textWithLink('Book Your Free Discovery Call →', MARGIN + 16, y, { url: CALENDLY_URL });
  y += 30;

  // ---------- FOOTER on every page ----------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(INK_SOFT);
    doc.text('Passion to Profit Roadmap · Budget4Success', MARGIN, PAGE_H - 26);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 26, { align: 'right' });
  }

  const fileName = `Passion-to-Profit-Roadmap-${(r.user_name || 'You').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
  doc.save(fileName);
}
