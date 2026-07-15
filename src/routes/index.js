

import { langchanRouter } from './langchain.routes.js';
import { Router } from 'express';

export const apiRouter = Router();
// /lc/chat/simple
apiRouter.use('/lc', langchanRouter);