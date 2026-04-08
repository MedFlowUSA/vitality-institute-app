export type PublicClinicLocation = {
  name: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  cityStateZip: string;
  hoursLabel: string;
  note?: string;
  website?: string;
};

export function normalizePublicClinicLocationName(name: string) {
  const trimmed = name.trim();
  if (trimmed === "Touch of Vitality" || trimmed === "Touch of Vitality Los Angeles" || trimmed === "Touch of Vitality - Los Angeles") {
    return "Touch of Vitality - Los Angeles";
  }
  return name;
}

export const PUBLIC_CLINIC_LOCATIONS: PublicClinicLocation[] = [
  {
    name: "Vitality Institute of Redlands",
    phone: "909-500-4572",
    email: "hello@vitalityinstitute.com",
    addressLine1: "411 W. State Street, Suite B",
    cityStateZip: "Redlands, CA 92373",
    hoursLabel: "Monday to Friday, 10:00 AM to 4:00 PM",
    website: "http://www.redlandsvitality.com/",
  },
  {
    name: "Touch of Vitality - Los Angeles",
    phone: "(213) 912-6838",
    addressLine1: "931 N Vignes St",
    addressLine2: "Suite 102-8",
    cityStateZip: "Los Angeles, CA 90012",
    hoursLabel: "Opening soon",
    note: "A modern wellness studio in Los Angeles with hyperbaric oxygen therapy, detox technology, body sculpting, and non-invasive fat reduction services.",
    website: "https://touchofvitality.life/contact-us/",
  },
];
