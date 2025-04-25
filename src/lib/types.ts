import { z } from 'zod';

export interface Selection<T> {
	value: T;
	key: string;
	selected: boolean;
}

export type PointData = [x: number, y: number];

export class Point {
	readonly x: number;
	readonly y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	toJSON(): PointData {
		return [this.x, this.y];
	}
}

export const PointSchema = z
	.object({
		x: z.number(),
		y: z.number()
	})
	.transform((data) => new Point(data.x, data.y));

export type PolygonData = [PointData, PointData, PointData, PointData, ...PointData[]];

type PolygonPoints = [Point, Point, Point, Point, ...Point[]];
export class Polygon {
	readonly points: PolygonPoints;

	constructor(points: PolygonPoints) {
		this.points = points;
	}

	toJSON(): PolygonData {
		return this.points.map((p) => p.toJSON()) as PolygonData;
	}
}

export const PolygonSchema = z
	.array(PointSchema)
	.min(4)
	.transform((data) => new Polygon(data as PolygonPoints));
