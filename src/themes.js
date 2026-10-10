/* The sixteen festive invoice themes the app sells, in the order the Theme
 * Store shows them (reference/frames/th-9.0.png and th-15.0.png). The slug is
 * the file name in kit/themes/ and the value a recipe puts in invoice.theme. */
export const FESTIVE_THEMES = [
  ['navaratri', 'Navaratri'], ['durga-puja', 'Durga Puja'], ['dussehra', 'Dussehra'],
  ['dhanteras', 'Dhanteras'], ['diwali', 'Diwali'], ['chhath-puja', 'Chhath Puja'],
  ['gandhi-jayanti', 'Gandhi Jayanti'], ['ganesh-chaturthi', 'Ganesh Chaturthi'],
  ['janmashtami', 'Janmashtami'], ['rakhi', 'Rakhi'], ['onam', 'Onam'],
  ['eid-e-milad', 'Eid-e-Milad'], ['independence', 'Independence'],
  ['shubh-ekadashi', 'Shubh Ekadashi'], ['jain-theme', 'Jain theme'], ['industrial', 'Industrial']
].map(([slug, name]) => ({ slug, name }));

export const THEME_SLUGS = FESTIVE_THEMES.map(t => t.slug);
