import 'express';
import { IUserPayload } from '..';

declare global {
  namespace Express {
    interface Request {
      user: IUserPayload;
    }
  }
}
