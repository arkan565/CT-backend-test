import { MongoClient } from 'mongodb';
import { CTSearch } from 'src/types';
import { journeyDestination, supplierStationCorrelation } from 'src/types/mongo';

const url = 'mongodb://localhost:27017';

let client: MongoClient;

export const getMongoClient = async (): Promise<MongoClient> => {
  if (!client) {
    client = await MongoClient.connect(url);
  }
  return client;
};

export const insertCTsearchs = async (searches: CTSearch[]) => {
  const client = await getMongoClient();
  const db = client.db('searches');
  const collection = db.collection('train_results');
  await collection.insertMany(searches);
};

export const getJourneyDestinationOptions = async (
  destinationCode: string,
  arrivalCode: string,
): Promise<journeyDestination[]> => {
  const client = await getMongoClient();
  const db = client.db('trainEngine');
  const collection = db.collection('journey_destination_tree');
  const filter = {
    $and: [
      {
        $or: [{ destinationCode: destinationCode }, { destinationTree: destinationCode }],
      },
      {
        $or: [{ arrivalCode: arrivalCode }, { arrivalTree: arrivalCode }],
      },
    ],
  };
  return await collection.find<journeyDestination>(filter).toArray();
};

export const getSuplierStationCorrelations = async (
  suplierStations: string[],
): Promise<supplierStationCorrelation[]> => {
  const client = await getMongoClient();
  const db = client.db('trainEngine');
  const collection = db.collection('supplier_station_correlation');
  const filter = {
    code: { $in: suplierStations },
  };
  return await collection.find<supplierStationCorrelation>(filter).toArray();
};
