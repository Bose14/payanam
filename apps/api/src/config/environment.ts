import dotenv from 'dotenv';
import path from 'path';
import { validateBackendEnv } from '@payanam/config';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const env = validateBackendEnv(process.env);

export default env;
