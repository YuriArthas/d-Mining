"""Build the contractor-facing art commission from its Markdown source."""
from pathlib import Path
import shutil
import markdown
from bs4 import BeautifulSoup, NavigableString, Comment
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/art-outsourcing/mining-art-brief-final.md'
OUTPUT = ROOT / 'docs/art-outsourcing/Mining_美术设计与制作需求书.docx'
PREVIOUS_LINK = ROOT / 'docs/art-outsourcing/Mining_最终美术需求书.docx'
content = SOURCE.read_text()
soup = BeautifulSoup(markdown.markdown(content, extensions=['tables', 'sane_lists']), 'html.parser')
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.top_margin, sec.bottom_margin = Cm(1.8), Cm(1.8)
sec.left_margin, sec.right_margin = Cm(1.9), Cm(1.9)
sec.header_distance, sec.footer_distance = Cm(.65), Cm(.65)
sec.different_first_page_header_footer = True

for name in ['Normal', 'Body Text', 'List Bullet', 'List Number']:
    style = doc.styles[name]
    style.font.name = 'Arial'
    style.font.size = Pt(10.5)
    style.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), 'Noto Serif CJK SC')
    style.paragraph_format.line_spacing = 1.2
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.widow_control = True
for name, size in [('Title', 23), ('Heading 1', 15), ('Heading 2', 11.5)]:
    style = doc.styles[name]
    style.font.name = 'Arial'
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string('202A35')
    style.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), 'Noto Sans CJK SC')
    style.paragraph_format.space_before = Pt(7 if name == 'Heading 2' else 0)
    style.paragraph_format.space_after = Pt(7)
    style.paragraph_format.keep_with_next = True
    style.paragraph_format.keep_together = True

header = sec.header.paragraphs[0]
header.text = 'MINING  /  美术设计与制作需求书'
header.runs[0].font.size = Pt(8)
header.runs[0].font.color.rgb = RGBColor.from_string('61747B')
for footer in [sec.footer, sec.first_page_footer]:
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run('第 ')
    run.font.size = Pt(8)
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    p._p.append(field)
    p.add_run(' 页').font.size = Pt(8)

def inline(paragraph, element, bold=False):
    for child in element.children:
        if isinstance(child, NavigableString):
            r = paragraph.add_run(str(child))
            r.bold = bold
        elif child.name == 'br':
            paragraph.add_run().add_break()
        else:
            inline(paragraph, child, bold or child.name in ['strong', 'b'])

def table(element):
    rows = element.find_all('tr')
    columns = len(rows[0].find_all(['th', 'td'], recursive=False))
    t = doc.add_table(rows=0, cols=columns)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    ratios = {2: [.28, .72], 3: [.23, .29, .48]}[columns]
    for col, ratio in zip(t.columns, ratios): col.width = Cm(17.2 * ratio)
    pr = t._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        b = OxmlElement('w:' + edge)
        for key, value in [('val','single'), ('sz','4'), ('color','D6E0E3')]: b.set(qn('w:' + key), value)
        borders.append(b)
    pr.append(borders)
    for index, row in enumerate(rows):
        cells = t.add_row().cells
        rowpr = cells[0]._tc.getparent().get_or_add_trPr()
        rowpr.append(OxmlElement('w:cantSplit'))
        if index == 0: rowpr.append(OxmlElement('w:tblHeader'))
        for col, (cell, item) in enumerate(zip(cells, row.find_all(['th', 'td'], recursive=False))):
            cell.width = Cm(17.2 * ratios[col])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cp = cell._tc.get_or_add_tcPr()
            margins = OxmlElement('w:tcMar')
            for edge, amount in [('top','65'),('bottom','65'),('left','90'),('right','90')]:
                m = OxmlElement('w:' + edge); m.set(qn('w:w'), amount); m.set(qn('w:type'),'dxa'); margins.append(m)
            cp.append(margins)
            if index == 0 or index % 2 == 0:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'), 'EAECEF' if index == 0 else 'F7F7F7'); cp.append(shade)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.12
            inline(p, item, index == 0)
            for r in p.runs: r.font.size = Pt(9.4)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)

pending_pagebreak = False
for el in soup.children:
    if isinstance(el, Comment):
        if 'pagebreak' in el: pending_pagebreak = True
    elif isinstance(el, NavigableString):
        continue
    elif el.name in ['h1', 'h2', 'h3']:
        p = doc.add_paragraph(style={'h1':'Title','h2':'Heading 1','h3':'Heading 2'}[el.name])
        if pending_pagebreak:
            p.paragraph_format.page_break_before = True
            pending_pagebreak = False
        inline(p, el)
        if el.name == 'h1': p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if el.name == 'h1' and 'Mining' in el.get_text():
            for r in p.runs: r.font.size = Pt(16)
    elif el.name == 'p':
        p = doc.add_paragraph()
        inline(p, el)
        if el.get_text().startswith('2026 年'):
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(12)
        else:
            p.paragraph_format.first_line_indent = Cm(.74)
    elif el.name == 'table':
        table(el)
    elif el.name in ['ol', 'ul']:
        for index, li in enumerate(el.find_all('li', recursive=False), 1):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(.45)
            p.paragraph_format.first_line_indent = Cm(-.45)
            p.add_run(f'{index}. ' if el.name == 'ol' else '• ')
            inline(p, li)
doc.core_properties.title = 'Mining 挖矿游戏美术设计与制作需求书'
doc.core_properties.subject = '美术委托范围、设计要求与成果交付'
doc.core_properties.author = 'Mining 项目组'
doc.core_properties.version = '6.3'
doc.save(OUTPUT)
shutil.copyfile(OUTPUT, PREVIOUS_LINK)
print(OUTPUT)
print(f'paragraphs={len(doc.paragraphs)} tables={len(doc.tables)} bytes={OUTPUT.stat().st_size}')
