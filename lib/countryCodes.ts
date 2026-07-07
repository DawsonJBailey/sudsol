export type CountryCode = {
  iso: string;
  name: string;
  dial: string;
};

export const COUNTRY_CODES: CountryCode[] = [
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "NL", name: "Netherlands", dial: "+31" },
  { iso: "SE", name: "Sweden", dial: "+46" },
  { iso: "MX", name: "Mexico", dial: "+52" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "KR", name: "South Korea", dial: "+82" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
];
