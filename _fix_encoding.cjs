const fs = require('fs');

function fixMojibake(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace 2-byte UTF-8 corruptions (e.g. Ã£)
  const regex2 = /[\xC2-\xDF][\x80-\xBF]/g;
  content = content.replace(regex2, (match) => {
    return Buffer.from(match, 'latin1').toString('utf8');
  });

  // Replace 3-byte UTF-8 corruptions (e.g. â€”)
  const regex3 = /[\xE0-\xEF][\x80-\xBF]{2}/g;
  content = content.replace(regex3, (match) => {
    return Buffer.from(match, 'latin1').toString('utf8');
  });

  // Specifically target Windows-1252 anomalies that might have slipped through
  // In CP1252, some bytes like 80-9F are assigned to printable characters.
  // Node's 'latin1' (ISO-8859-1) treats them as control chars (U+0080 to U+009F).
  // E.g., '—' in UTF-8 is E2 80 94. 
  // In CP1252, E2 = â, 80 = €, 94 = ”. So it's 'â€”'.
  // If the file was read as utf8, those characters are U+00E2, U+20AC, U+201D.
  // My regex3 above wouldn't match because U+20AC is not in \x80-\xBF!
  
  // So I will also do explicit string replacements for common CP1252 corruptions just in case:
  const cp1252Replacements = {
    'â€”': '—',
    'Ã£': 'ã',
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã­': 'í',
    'Ãµ': 'õ',
    'Ã¢': 'â',
    'Ãª': 'ê',
    'Ã§': 'ç',
    'Ã ': 'À',
    'Ã\x8D': 'Í',
    'Ã\x9A': 'Ú',
    'Ã\x89': 'É',
    'Ã\x93': 'Ó',
    'Ã\x81': 'Á',
    'Ã\x87': 'Ç',
    'Ã£o': 'ão',
    'Ã§Ã£o': 'ção',
    'Ã§Ãµes': 'ções',
    'Âº': 'º',
    'TÃ­tulo': 'Título',
    'DescriÃ§Ã£o': 'Descrição',
    'usuÃ¡rios': 'usuários'
  };

  for (const [bad, good] of Object.entries(cp1252Replacements)) {
    content = content.split(bad).join(good);
  }
  
  // Also some specific powershell output corruptions we saw:
  content = content.replace(/Gestǜo/g, 'Gestão');
  content = content.replace(/Descriǜo/g, 'Descrição');
  content = content.replace(/Ttulo/g, 'Título');
  content = content.replace(/Aprovaǜo/g, 'Aprovação');
  content = content.replace(/Movimentaǜo/g, 'Movimentação');
  content = content.replace(/Criaǜo/g, 'Criação');
  content = content.replace(/Aǜo/g, 'Ação');
  content = content.replace(/aes/g, 'ações');
  content = content.replace(/Atribuies/g, 'Atribuições');
  content = content.replace(/Informaes/g, 'Informações');
  content = content.replace(/Atribuiǜo/g, 'Atribuição');
  content = content.replace(/Distribuio/g, 'Distribuição');
  content = content.replace(/Posio/g, 'Posição');
  content = content.replace(/Gamificao/g, 'Gamificação');
  content = content.replace(/concludas/g, 'concluídas');
  content = content.replace(/comentǭrio/g, 'comentário');
  content = content.replace(/Comentǭrios/g, 'Comentários');
  content = content.replace(/usuǭrios/g, 'usuários');
  content = content.replace(/Responsǭvel/g, 'Responsável');
  content = content.replace(/TǸcnico/g, 'Técnico');
  content = content.replace(/Perodo/g, 'Período');
  content = content.replace(/sltimo/g, 'Último');
  content = content.replace(/Avanar/g, 'Avançar');
  content = content.replace(/Conteǧdo/g, 'Conteúdo');
  content = content.replace(/\?"/g, '—');
  content = content.replace(/PrÃ³ximo/g, 'Próximo');
  content = content.replace(/hÃ¡ /g, 'há ');
  content = content.replace(/MÃ©tricas/g, 'Métricas');
  content = content.replace(/NÃ­vel/g, 'Nível');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed ' + filePath);
}

fixMojibake('public/index.html');
fixMojibake('public/js/main.js');
