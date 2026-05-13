import { Router } from 'express';
import type { IRouter } from 'express-serve-static-core';
import * as heatmapService from '../services/heatmap.js';
import { asyncHandler } from '../lib/async-handler.js';

export const heatmapRouter: IRouter = Router();

heatmapRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { crimeTypes, severities, dateFrom, dateTo, areas } = req.query;

    const filter: Parameters<typeof heatmapService.getHeatmapData>[0] = {};

    if (crimeTypes && typeof crimeTypes === 'string') {
      filter.crimeTypes = crimeTypes.split(',') as any;
    }
    if (severities && typeof severities === 'string') {
      filter.severities = severities.split(',') as any;
    }
    if (dateFrom && typeof dateFrom === 'string') {
      filter.dateFrom = new Date(dateFrom);
    }
    if (dateTo && typeof dateTo === 'string') {
      filter.dateTo = new Date(dateTo);
    }
    if (areas && typeof areas === 'string') {
      filter.areas = areas.split(',');
    }

    const data = await heatmapService.getHeatmapData(filter);
    res.json({ success: true, data });
  })
);
