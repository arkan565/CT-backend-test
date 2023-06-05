import * as express from 'express';
import { Parameters } from './types';
import { getTrainJourneys } from './utils';
const app = express();
const port = 3000;
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));
app.post('/', async (req, res) => {
  const body: Parameters = req.body;
  res.send(await getTrainJourneys(body));
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
