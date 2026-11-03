// Common Nigerian bank / MFB codes (NIP/CBN). In production load the full list from the provider's /bank endpoint and cache it.
export const BANKS: { code: string; name: string }[] = [
  { code: "044", name: "Access Bank" }, { code: "023", name: "Citibank Nigeria" }, { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" }, { code: "011", name: "First Bank of Nigeria" }, { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" }, { code: "030", name: "Heritage Bank" }, { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" }, { code: "50515", name: "Moniepoint MFB" }, { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" }, { code: "076", name: "Polaris Bank" }, { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" }, { code: "068", name: "Standard Chartered" }, { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" }, { code: "033", name: "United Bank for Africa" }, { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" }, { code: "057", name: "Zenith Bank" }, { code: "50211", name: "Kuda MFB" },
];
export const bankName = (code: string) => BANKS.find((b) => b.code === code)?.name ?? code;
