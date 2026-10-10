export const palettes = [
  "#ad8872",
  "#86a18a",
  "#b7a57c",
  "#9594b3",
  "#cb8e88",
  "#7b9aa7",
];

export const categoryStyle = (name) => {
  const known = {
    Alimentação: ["food", "#ad8872"],
    Moradia: ["home", "#86a18a"],
    Transporte: ["car", "#b7a57c"],
    Saúde: ["heart", "#cb8e88"],
    Educação: ["book", "#9594b3"],
    Salário: ["wallet", "#86a18a"],
  };
  if (Object.hasOwn(known, name)) return known[name];
  return [
    "receipt",
    palettes[
      Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        palettes.length
    ],
  ];
};

export const mainCategories = [
  "Moradia",
  "Alimentação",
  "Assinaturas",
  "Lazer",
  "Pensão",
  "Dívidas de cartão",
  "Empréstimos",
];

export const categoryHints = {
  Moradia: "Aluguel, condomínio e contas da casa.",
  Alimentação: "Mercado, refeições e delivery.",
  Assinaturas: "Streaming, aplicativos e serviços mensais.",
  Lazer: "Passeios, viagens e entretenimento.",
  Pensão: "Pagamentos de pensão.",
  "Dívidas de cartão": "Compras parceladas e acordos do cartão.",
  Empréstimos: "Parcelas e pagamentos de empréstimos.",
};
