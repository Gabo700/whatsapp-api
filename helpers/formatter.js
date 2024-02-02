// Função para formatar números de telefone
const phoneNumberFormatter = function(number) {
  // 1. Remove caracteres que não são dígitos
  let formatted = number.replace(/\D/g, '');

  // 2. Remove o zero inicial (prefixo) e substitui por 62
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.substr(1);
  }

  // 3. Adiciona a terminação '@c.us' se não estiver presente
  if (!formatted.endsWith('@c.us')) {
    formatted += '@c.us';
  }

  return formatted;
}

// Exporta a função para uso em outros arquivos
module.exports = {
  phoneNumberFormatter
}
