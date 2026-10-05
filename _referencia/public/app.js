// Único JavaScript del portal: el botón de imprimir. Externo para que la
// política de seguridad de contenido pueda prohibir scripts en línea.
document.querySelectorAll('[data-imprimir]').forEach((b) =>
  b.addEventListener('click', () => window.print()))
