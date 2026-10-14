import dotenv from 'dotenv';
import { seedSyntheticData } from '../src/fixtures/seedSynthetic.js';

dotenv.config();

const result = seedSyntheticData();
console.log('Synthetic seed complete:', JSON.stringify(result, null, 2));
