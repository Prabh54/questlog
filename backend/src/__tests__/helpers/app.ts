import request from 'supertest';
import { createApp } from '../../app';

export const app = createApp();
export const agent = request(app);
