

import { langchanRouter } from './langchain.routes.js';
import { langgraphRouter } from './langgraph.routes.js'
import { Router } from 'express';

export const apiRouter = Router();
// /lc/chat/simple
apiRouter.use('/lc', langchanRouter);
apiRouter.use('/lg', langgraphRouter);