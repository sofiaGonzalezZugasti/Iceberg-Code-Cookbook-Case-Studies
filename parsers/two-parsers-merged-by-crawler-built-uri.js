// ============================================================================
// WHEN TO USE THIS
// One crawl feeds two parsers that must end up in the SAME record: a listing
// parser for the metadata and a binary parser for the file, its rendering and
// its text.
//
// HOW IT WORKS
// The crawler builds the merge key ONCE and writes it in the two places the
// parsers read: data-doc on each normalised table row, and ?doc= on the binary
// URL. Neither parser computes it; both read it. That is what guarantees the two
// sides are byte-identical, which is the condition for merging.
//
// WARNINGS / GOTCHAS
// - Two independent pieces of code deriving "the same" key from the same HTML
//   WILL diverge on some row, and those records never merge, with no error
//   anywhere. Build it once upstream.
// - If the URI shape changes, neither parser changes. That is the test of
//   whether the split is right.
// - Both parsers write `title` with the same value, so the record has a label
//   whichever one arrives first. Use `=`, not `+=`: a non-multivalue field with
//   `+=` ends up as "CODE | CODE".
// - A field a parser returns with NO mapping is dropped silently. After writing
//   a parser, diff the keys of the return against the mapping list.
// - A failing mapping aborts the WHOLE record and the engine stops at the first
//   failure, so the absence of errors on the other fields is not evidence that
//   they work.
// - The binary parser must bound ?doc= with [^&]+ and not .+$ : a greedy match
//   swallows the following parameters and the key stops matching.
// ============================================================================

const LOCALE    = 'es';
const MIN_TEXTO = 50;
const MIN_HTML  = 200;
const MAX_TEXTO = 2000000;
const MAX_HTML  = 150000;

function limpiar(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

// ===========================================================================
// PARSER A — listing. Reads the normalised table the crawler emits:
//
//   <tr data-ri="10" data-id="245825" data-doc="<URI>">
//     <td class="cesTipo">Reglamentos</td>
//     <td class="cesCodigo">RPC-SE-19-No.055-2021</td>
//     <td class="cesFecha">2021/06/28</td>
//     <td class="cesDescripcion">...</td>
//   </tr>
//
// Normalising upstream removed the sibling walk, the indexOf(code) slicing, the
// date/description splitting regex and the encoding patch: ~150 lines -> ~50.
// ===========================================================================
function parsePageListado({ responseBody, URL }) {
  if (!responseBody || !responseBody.content) {
    console.error('sin contenido:', URL);
    return [];
  }

  const $ = cheerio.load(responseBody.content);
  const results = [];
  const vistos = new Set();

  $('tr[data-ri]').each(function () {
    const $tr = $(this);

    const uri = limpiar($tr.attr('data-doc'));
    if (!uri) { console.error('fila sin data-doc, salto'); return; }
    if (vistos.has(uri)) return;
    vistos.add(uri);

    const tipo     = limpiar($tr.find('td.cesTipo').text());
    const codigo   = limpiar($tr.find('td.cesCodigo').text());
    const fechaRaw = limpiar($tr.find('td.cesFecha').text());

    // Newlines are kept: long descriptions carry multi-line programme lists.
    let descripcion = String($tr.find('td.cesDescripcion').text() || '')
                        .replace(/[ \t]+/g, ' ')
                        .replace(/\s*\n\s*/g, '\n')
                        .trim();

    if (!codigo) { console.error(`fila sin codigo en ${uri}`); return; }

    const derogado = /\(\s*Derogado\s*\)/i.test(descripcion);
    if (derogado) {
      descripcion = descripcion.replace(/\(\s*Derogado\s*\)/ig, '').replace(/\s{2,}/g, ' ').trim();
    }

    // strict=true as the 4th argument: an unknown format yields Invalid rather
    // than an invented date, visible as date=null in the Preview.
    const d = fechaRaw
      ? moment(fechaRaw, ['YYYY/MM/DD', 'DD/MM/YYYY', 'YYYY-MM-DD'], LOCALE, true)
      : null;
    if (fechaRaw && !d.isValid()) console.error(`fecha no parseada: "${fechaRaw}" en ${codigo}`);

    results.push({
      URI: [uri],
      documentType: tipo,
      title: codigo,
      docNumber: codigo,
      date: d && d.isValid() ? d.format('YYYY-MM-DD') : null,
      description: descripcion || null,
      emisor: 'CES',
      derogado: derogado ? 'yes' : 'no',
      listingURL: URL,
    });
  });

  if (!results.length) console.error('0 registros extraidos de', URL);
  return results;
}

// ===========================================================================
// PARSER B — binary content.
//
// The filters (pdf2htmlEx, pdftotext, tesseractOCRSpanish) must be CONFIGURED
// in the parser's Configuration tab. Without them filterOutputs arrives empty
// and the field is simply absent, with no error: "origen=-" in the log means
// the filter is missing, not that the file is bad.
// ===========================================================================
function contenidoDeFiltro(filterOutputs, nombres) {
  if (!filterOutputs) return '';
  for (const n of nombres) {
    const fo = filterOutputs[n];
    if (fo && typeof fo.content === 'string' && fo.content.trim()) return fo.content;
  }
  return '';
}

// Measure the SIGNAL, not the wrapper: pdf2htmlEx emits stylesheets and font
// definitions, so a blank page clears 300 characters of HTML easily.
function textoVisible(h) {
  try {
    const $ = cheerio.load(h);
    const cuerpo = limpiar($('body').text());
    return cuerpo || limpiar($.root().text());
  } catch (e) { return ''; }
}

// NEVER truncate markup by character count: it cuts mid-tag and the result is
// unusable. pdf2htmlEx emits one <div id="pf..."> per page; cut there.
function recortarHtml(h, clave) {
  if (h.length <= MAX_HTML) return h;

  const marca = /<div[^>]*\bid="pf[0-9a-zA-Z]+"/gi;
  let corte = -1;
  let m;
  while ((m = marca.exec(h)) !== null) {
    if (m.index > MAX_HTML) break;
    if (m.index > 0) corte = m.index;
  }
  if (corte <= 0) {
    console.error(`html de ${h.length} car sin limite de pagina en ${clave}, no lo emito`);
    return '';
  }
  console.error(`html recortado por pagina en ${clave}: ${h.length} -> ${corte}`);
  return h.slice(0, corte) + '</div>';
}

async function parsePagePdf({ responseBody, URL, html, filterOutputs }) {
  // For binaries responseBody.content is undefined, so guard on fileFormat.
  if (!/pdf/i.test((responseBody && responseBody.fileFormat) || '')) {
    console.error('no es PDF, salto:', URL);
    return [];
  }

  const m = URL.match(/[?&]doc=([^&]+)/);
  if (!m) { console.error('canonical sin ?doc=:', URL); return []; }
  const clave = decodeURIComponent(m[1]);

  // The crawler passes the document code separately: it is no longer inside
  // the URI, and it is needed for the title and the identity check.
  const mc = URL.match(/[?&]cod=([^&]+)/);
  const docNumber = mc ? decodeURIComponent(mc[1]) : '';

  const out = { URI: [clave] };
  if (docNumber) { out.title = docNumber; out.docNumber = docNumber; }

  // The binary is already stored by the crawler: reference it, do not resend.
  if (responseBody.id) {
    out.originalPdf = [{ mediaObjectId: responseBody.id, locale: LOCALE, dataType: 'MEDIA' }];
    out.originalPdfId = responseBody.id;
  }

  let h = (html && html.trim()) ? html : contenidoDeFiltro(filterOutputs,
            ['pdftohtmlEX', 'pdf2htmlEx', 'transcodedMediaObject']);
  let visible = h ? textoVisible(h) : '';

  // When the converter fails over a file that is not really a PDF, what comes
  // back has none of its structure.
  if (h && !/<span|<div[^>]*class=/i.test(h)) {
    console.error(`html sin estructura del conversor en ${clave}, descarto`);
    h = ''; visible = '';
  }
  if (h && visible.length < MIN_HTML) {
    console.error(`html descartado (${visible.length} car visibles) en ${clave}`);
    h = ''; visible = '';
  }
  if (h) {
    const hs = recortarHtml(h, clave);
    if (hs) out.content = hs;
  }

  let t = contenidoDeFiltro(filterOutputs, ['pdftotext', 'pdftotext_raw']);
  let origen = t.trim() ? 'pdftotext' : '';
  if (!t.trim()) {
    t = contenidoDeFiltro(filterOutputs, ['tesseractOCRSpanish', 'tesseractOCR']);
    if (t.trim()) origen = 'ocr';
  }

  // trim() non-empty is not the same as useful: a three-character residue
  // passes the guard and then the mapping cannot classify it.
  if (t.trim().length < MIN_TEXTO) { t = ''; origen = ''; }
  if (t) out.fullText = t.length > MAX_TEXTO ? t.slice(0, MAX_TEXTO) : t;

  console.error(`${clave}: title=${out.title || '-'} pdf=${out.originalPdfId || '-'} ` +
                `content=${out.content ? out.content.length : 0} visibles=${visible.length} ` +
                `fullText=${out.fullText ? out.fullText.length : 0} origen=${origen || '-'}`);

  // A record with a URI and no content is worse than no record: merged with the
  // metadata side it looks complete until someone opens it.
  if (!out.originalPdf && !out.content && !out.fullText) {
    console.error(`sin contenido aprovechable, no emito registro: ${clave}`);
    return [];
  }

  return [out];
}
