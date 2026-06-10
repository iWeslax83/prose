/** Intents that compile and run with zero API keys (the mock compiler handles them). */
export const SHOWCASE_INTENTS: { label: string; source: string }[] = [
  {
    label: "hava + hatırlatıcı",
    source:
      "Bugün Bursa'da hava yağmurlu mu? Yağmurluysa bana bir hatırlatıcı taslağı oluştur.",
  },
  {
    label: "hacker news + e-posta",
    source:
      "Hacker News'te ilk 5 başlığı al, hepsini maddele, bir e-posta taslağı yap.",
  },
  {
    label: "wikipedia + özet",
    source:
      'Wikipedia\'da "transformer (machine learning)" özetini çek ve 3 maddeye indir.',
  },
  {
    label: "takvim + hafta sonu",
    source:
      "Her cumartesi takvime bak; hafta sonuysa pazartesi sabahı bana özet hatırlatıcı at.",
  },
];
