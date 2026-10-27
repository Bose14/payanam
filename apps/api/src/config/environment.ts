import { validateBackendEnv } from '@payanam/config';

const env = validateBackendEnv(process.env);

export default env;
