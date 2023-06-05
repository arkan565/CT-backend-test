export type timetablesQuery = {
  adults: string;
  childrens: string;
};
export type timetablesBody = {
  from: string;
  to: string;
  date: string;
};

export type timeTable = {
  shipId: string;
  departureDate: string;
  arrivalDate: string;
};
export type timetablesResponse = {
  timeTables: timeTable[];
};

export type accomodationsBody = {
  shipID: string;
  departureDate: string;
};

export type accommodationResponse = {
  type?: string;
  shipId?: string;
  available: number;
};
export type accomodationsResponse = {
  accommodations: accommodationResponse[];
};

export type pricesQuery = {
  pax: 'adult' | 'child';
  bonus: string[];
};

export type pricesBody = {
  shipID: string;
  departureDate: string;
  accommodation: string;
};
