import {
  getJourneyDestinationOptions,
  getSuplierStationCorrelations,
  insertCTsearchs,
} from './repository/mongo';
import { fetchAccommodations, fetchPrices, fetchTimetables } from './servivueloApi';
import { CTSearch, CTSearchJourney, Parameters } from './types';
import { journeyAccommodationPricingMapType } from './types/internal';
import { journeyDestination, supplierStationCorrelation } from './types/mongo';
import { timetablesBody, timetablesQuery, timetablesResponse } from './types/servivuelo';

export const getTrainType = (journeys: Parameters['journeys']): CTSearch['train']['type'] => {
  if (journeys.length == 1) {
    return 'oneway';
  }
  if (
    journeys.length == 2 &&
    journeys[0].from == journeys[1].to &&
    journeys[0].to == journeys[1].from
  ) {
    return 'roundtrip';
  }
  return 'multidestination';
};

const mapDBProviderCode = (
  supplierStations: supplierStationCorrelation[],
): { [key: string]: string } => {
  return supplierStations.reduce((acc, curr) => {
    let supplierCode = '';
    curr.suppliers.forEach(supplier => {
      const splitString = supplier.split('#');
      if (splitString[0].toLowerCase() == 'servivuelo') {
        supplierCode = splitString[1];
      }
    });
    acc[curr.code] = supplierCode;
    return acc;
  }, {});
};

const getAllJourneyOptions = async (
  timetables: timetablesResponse,
  parameters: Parameters,
  journey: Parameters['journeys'][0],
  journeyDestionationOption: journeyDestination,
): Promise<journeyAccommodationPricingMapType[]> => {
  const result: journeyAccommodationPricingMapType[] = [];
  for (let i = 0; i < timetables.timeTables.length; i++) {
    const accommodations = await fetchAccommodations({
      shipID: timetables.timeTables[i].shipId,
      departureDate: timetables.timeTables[i].departureDate,
    });
    for (let j = 0; j < accommodations.accommodations.length; j++) {
      if (accommodations.accommodations[j].available < parameters.passenger.total) continue;
      const adultprice = await fetchPrices(
        {
          pax: 'adult',
          bonus: parameters.bonus || [],
        },
        {
          shipID: timetables.timeTables[i].shipId,
          departureDate: timetables.timeTables[i].departureDate,
          accommodation:
            accommodations.accommodations[j].type || accommodations.accommodations[j].shipId,
        },
      );
      const childprice = await fetchPrices(
        {
          pax: 'child',
          bonus: parameters.bonus || [],
        },
        {
          shipID: timetables.timeTables[i].shipId,
          departureDate: timetables.timeTables[i].departureDate,
          accommodation:
            accommodations.accommodations[j].type || accommodations.accommodations[j].shipId,
        },
      );
      result.push({
        departureCode: journeyDestionationOption.destinationCode,
        arrivalCode: journeyDestionationOption.arrivalCode,
        date: journey.date,
        departureTime: timetables.timeTables[i].departureDate,
        arrivalTime: timetables.timeTables[i].arrivalDate,
        accomodation:
          accommodations.accommodations[j].type || accommodations.accommodations[j].shipId,
        adultPrice: adultprice,
        childPrice: childprice,
      });
    }
  }
  return result;
};

const mapJourneys = (journeyMap: journeyAccommodationPricingMapType[]): CTSearchJourney[] =>
  journeyMap.map(journey => {
    const dateDifference =
      new Date(`${journey.date} ${journey.arrivalTime}`).getTime() -
      new Date(`${journey.date} ${journey.departureTime}`).getTime();
    const minutes = Math.floor(dateDifference / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    return {
      departure: {
        date: journey.date,
        time: journey.departureTime,
        station: journey.departureCode,
      },
      arrival: {
        date: journey.date,
        time: journey.arrivalTime,
        station: journey.arrivalCode,
      },
      duration: {
        hours,
        minutes: minutes - hours * 60,
      },
    };
  });
const combineRows = (
  combinedRow: journeyAccommodationPricingMapType[][],
  rowToCombine: journeyAccommodationPricingMapType[],
): journeyAccommodationPricingMapType[][] => {
  if (combinedRow.length == 0) return rowToCombine.map(journey => [journey]);
  let result = [];
  combinedRow.forEach(combinedRowJourney => {
    const combinedResult = [];
    rowToCombine.forEach(rowToCombineJourney => {
      if (combinedRowJourney[0].accomodation == rowToCombineJourney.accomodation)
        combinedResult.push([...combinedRowJourney, rowToCombineJourney]);
    });

    result = [...result, ...combinedResult];
  });
  return result;
};
const getAllPossibilities = (journeyMapTypes: journeyAccommodationPricingMapType[][]) => {
  let result: journeyAccommodationPricingMapType[][] = [];
  for (const journeyMapType of journeyMapTypes) {
    result = combineRows(result, journeyMapType);
  }
  return result;
};
const buildCTSearch = (
  result: journeyAccommodationPricingMapType[][],
  parameters: Parameters,
): CTSearch[] => {
  const possibilities = getAllPossibilities(result);

  return possibilities.map(possibility => {
    const price: CTSearch['price'] = possibility.reduce(
      (acc, curr) => {
        acc.total +=
          curr.adultPrice * parameters.passenger.adults +
          curr.childPrice * parameters.passenger.children;
        acc.breakdown.adult += curr.adultPrice;
        acc.breakdown.children += curr.childPrice;
        return acc;
      },
      {
        total: 0,
        breakdown: {
          adult: 0,
          children: 0,
        },
      },
    );
    return {
      parameters,
      train: {
        type: getTrainType(parameters.journeys),
        journeys: mapJourneys(possibility),
        accommodations: {
          type: possibility[0].accomodation,
          passengers: {
            adults: parameters.passenger.adults.toString(),
            children: parameters.passenger.children.toString(),
          },
        },
      },
      price,
    };
  });
};

export const getTrainJourneys = async (parameters: Parameters) /*: CTSearchJourney*/ => {
  const promises: Array<Promise<journeyAccommodationPricingMapType[]>> =
    await parameters.journeys.map(async journey => {
      const journeyDestinationOptions = await getJourneyDestinationOptions(
        journey.to,
        journey.from,
      );
      const suplierStationsList = new Set<string>();
      journeyDestinationOptions.forEach(journeyDestination => {
        suplierStationsList.add(journeyDestination.arrivalCode);
        suplierStationsList.add(journeyDestination.destinationCode);
      });
      const suplierStations = await getSuplierStationCorrelations(Array.from(suplierStationsList));
      const supplierStationsMap = mapDBProviderCode(suplierStations);
      const query: timetablesQuery = {
        adults: parameters.passenger.adults.toString(),
        childrens: parameters.passenger.children.toString(),
      };
      let result: journeyAccommodationPricingMapType[] = [];
      for (let i = 0; i < journeyDestinationOptions.length; i++) {
        const body: timetablesBody = {
          from: supplierStationsMap[journeyDestinationOptions[i].arrivalCode] || '',
          to: supplierStationsMap[journeyDestinationOptions[i].destinationCode] || '',
          date: journey.date,
        };
        const timetables = await fetchTimetables(query, body);
        const journeyOptions = await getAllJourneyOptions(
          timetables,
          parameters,
          journey,
          journeyDestinationOptions[i],
        );
        result = result.concat(journeyOptions);
      }
      return result;
    });
  const result = await Promise.all(promises);
  const mergedResults = buildCTSearch(result, parameters);
  await insertCTsearchs(mergedResults);
  return mergedResults;
};
