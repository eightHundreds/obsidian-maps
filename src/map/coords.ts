/**
 * WGS-84 <-> GCJ-02 coordinate transformation
 * GCJ-02 is used by Chinese maps (Amap, Tencent, Google CN)
 */

const PI = Math.PI;
const A = 6378245.0; // Semi-major axis
// eslint-disable-next-line no-loss-of-precision
const EE = 0.00669342162296594323; // Eccentricity squared

function transformLat(x: number, y: number): number {
	let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
	ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
	ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
	ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
	return ret;
}

function transformLng(x: number, y: number): number {
	let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
	ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
	ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
	ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
	return ret;
}

/** Check if coordinate is outside China (no transformation needed) */
export function outOfChina(lat: number, lng: number): boolean {
	return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/** Convert WGS-84 to GCJ-02 */
export function wgs84ToGcj02(lat: number, lng: number): [number, number] {
	if (outOfChina(lat, lng)) {
		return [lat, lng];
	}
	let dLat = transformLat(lng - 105.0, lat - 35.0);
	let dLng = transformLng(lng - 105.0, lat - 35.0);
	const radLat = lat / 180.0 * PI;
	let magic = Math.sin(radLat);
	magic = 1 - EE * magic * magic;
	const sqrtMagic = Math.sqrt(magic);
	dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
	dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
	return [lat + dLat, lng + dLng];
}

/** Convert GCJ-02 to WGS-84 (iterative method for better accuracy) */
export function gcj02ToWgs84(lat: number, lng: number): [number, number] {
	if (outOfChina(lat, lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
		return [lat, lng];
	}
	const MAX_ITER = 10;
	const TOLERANCE = 1e-5;
	let wgsLat = lat, wgsLng = lng;
	for (let i = 0; i < MAX_ITER; i++) {
		const [mLat, mLng] = wgs84ToGcj02(wgsLat, wgsLng);
		const dLat = mLat - lat, dLng = mLng - lng;
		if (Math.abs(dLat) < TOLERANCE && Math.abs(dLng) < TOLERANCE) {
			break;
		}
		wgsLat -= dLat;
		wgsLng -= dLng;
	}
	return [wgsLat, wgsLng];
}
