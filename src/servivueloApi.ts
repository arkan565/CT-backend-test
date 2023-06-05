import axios from 'axios';
import {
  timetablesQuery,
  timetablesBody,
  accomodationsBody,
  pricesBody,
  timetablesResponse,
  pricesQuery,
  accomodationsResponse,
} from './types/servivuelo';
const baseUrl = 'http://localhost/servivuelo/';

export const fetchTimetables = async (
  query: timetablesQuery,
  body: timetablesBody,
): Promise<timetablesResponse> => {
  const response = await axios.post<timetablesResponse>(`${baseUrl}timetables`, body, {
    params: query,
  });
  return response.data;
};

export const fetchAccommodations = async (
  body: accomodationsBody,
): Promise<accomodationsResponse> => {
  const response = await axios.post<accomodationsResponse>(`${baseUrl}accommodations`, body);
  return response.data;
};

export const fetchPrices = async (query: pricesQuery, body: pricesBody) => {
  const response = await axios.post<number>(`${baseUrl}prices`, body, {
    params: {
      pax: query.pax,
      bonus: query.pax === 'adult' ? JSON.stringify(query.bonus) : undefined,
    },
  });
  return response.data;
};
