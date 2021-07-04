

export interface CustomVector {
    x: number; y: number;
}
function isCustomVector(obj: number | MouseEvent | CustomVector | GeolocationCoordinates): obj is CustomVector {
    return typeof obj !== 'number' && 'x' in obj && 'y' in obj;
} function isGeoVector(obj: number | MouseEvent | GeolocationCoordinates | CustomVector): obj is GeolocationCoordinates {
    return typeof obj !== 'number' && 'latitude' in obj && 'longitude' in obj;
}
export class Vector2 {


    constructor(x: number | MouseEvent | CustomVector | GeolocationCoordinates, y?: number) {
        if (x instanceof MouseEvent) {
            this.y = x.offsetY;
            this.x = x.offsetX;
        } else if (isCustomVector(x)) {
            this.y = x.y;
            this.x = x.x;
        } else if (isGeoVector(x)) {
            this.y = x.longitude;
            this.x = x.latitude;
        } else if (y) {
            this.x = x;
            this.y = y;
        } else {
            this.x = x;
            this.y = 0
        }
    }

    static ZERO = new Vector2(0, 0);

    readonly x: number;
    readonly y: number;
    limit(arg0: Vector2): Vector2 {
        return new Vector2(Math.min(this.x, arg0.x), Math.min(this.y, arg0.y));
    }

    round(): Vector2 {
        return new Vector2(Math.round(this.x), Math.round(this.y));
    }

    floor(): Vector2 {
        return new Vector2(Math.floor(this.x), Math.floor(this.y));
    }

    add(direction: Vector2) {
        return new Vector2(this.x + direction.x, this.y + direction.y);
    }

    addX(x: number): Vector2 {
        return new Vector2(this.x + x, this.y);
    }

    sub(direction: Vector2) {
        return new Vector2(this.x - direction.x, this.y - direction.y);
    }

    magnitude() {
        return Math.sqrt(this.lengthSqr());
    }

    div(divisor: number | Vector2) {
        if (divisor instanceof Vector2) {
            return new Vector2(this.x / divisor.x, this.y / divisor.y);
        }
        return new Vector2(this.x / divisor, this.y / divisor);
    }

    mult(multiplicator: number | Vector2) {
        if (multiplicator instanceof Vector2) {
            return new Vector2(this.x * multiplicator.x, this.y * multiplicator.y);
        }
        return new Vector2(this.x * multiplicator, this.y * multiplicator);
    }


    dot(vector2: Vector2) {
        return this.x * vector2.x + this.y * vector2.y;
    }

    lengthSqr() {
        return (this.x * this.x) + (this.y * this.y);
    }

    toIndex(squareWidth: number): number {
        return this.y * squareWidth + this.x
    }

}
