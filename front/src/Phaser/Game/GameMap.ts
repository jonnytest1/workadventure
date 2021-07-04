import type { Vector } from 'matter';
import { CustomVector, Vector2 } from '../../utility/vector';
import type { ITiledMap, ITiledMapLayerProperty } from "../Map/ITiledMap";
import { LayersIterator } from "../Map/LayersIterator";

export type PropertyChangeCallback = (newValue: string | number | boolean | undefined, oldValue: string | number | boolean | undefined, allProps: Map<string, string | boolean | number>) => void;

/**
 * A wrapper around a ITiledMap interface to provide additional capabilities.
 * It is used to handle layer properties.
 */
export class GameMap {
    private key: number | undefined;
    private lastProperties = new Map<string, string | boolean | number>();
    private callbacks = new Map<string, Array<PropertyChangeCallback>>();

    private tileSetPropertyMap: { [tile_index: number]: Array<ITiledMapLayerProperty> } = {}
    public readonly layersIterator: LayersIterator;

    public exitUrls: Array<string> = []

    public topLeft?: Vector2
    public bottomRight?: Vector


    public mapDimensions: Vector2
    public geocoordinationDimensions?: Vector2;
    geoRotation?: number;




    public constructor(private map: ITiledMap) {
        this.layersIterator = new LayersIterator(map);

        let partialTopLeft: Partial<GeolocationCoordinates> = {}
        let partialBottomRight: Partial<GeolocationCoordinates> = {}
        for (const prop of map.properties || []) {
            if (prop.name == "startLat" && typeof prop.value == "number") {
                partialTopLeft = { ...partialTopLeft, latitude: prop.value }
            } else if (prop.name == "startLon" && typeof prop.value == "number") {
                partialTopLeft = { ...partialTopLeft, longitude: prop.value }
            } else if (prop.name == "endLat" && typeof prop.value == "number") {
                partialBottomRight = { ...partialBottomRight, latitude: prop.value }
            } else if (prop.name == "endLon" && typeof prop.value == "number") {
                partialBottomRight = { ...partialBottomRight, longitude: prop.value }
            } else if (prop.name == "geoRotation" && typeof prop.value == "number") {
                this.geoRotation = prop.value
            }
        }

        for (const tileset of map.tilesets) {
            tileset?.tiles?.forEach(tile => {
                if (tile.properties) {
                    this.tileSetPropertyMap[tileset.firstgid + tile.id] = tile.properties
                    tile.properties.forEach(prop => {
                        if (prop.name == "exitUrl" && typeof prop.value == "string") {
                            this.exitUrls.push(prop.value);
                        }
                    })
                }
            })
        }

        if (partialTopLeft.latitude && partialTopLeft.longitude) {
            this.topLeft = new Vector2(partialTopLeft as GeolocationCoordinates);
        }
        if (partialBottomRight.latitude && partialBottomRight.longitude) {
            this.bottomRight = new Vector2(partialBottomRight as GeolocationCoordinates);
        }
        this.mapDimensions = new Vector2(this.map.tilewidth * this.map.width, this.map.tileheight * this.map.height)

        if (this.bottomRight && this.topLeft) {
            this.geocoordinationDimensions = new Vector2(this.bottomRight)
                .sub(this.topLeft)
        }
    }



    /**
     * Sets the position of the current player (in pixels)
     * This will trigger events if properties are changing.
     */
    public setPosition(x: number, y: number) {
        const xMap = Math.floor(x / this.map.tilewidth);
        const yMap = Math.floor(y / this.map.tileheight);
        const key = xMap + yMap * this.map.width;
        if (key === this.key) {
            return;
        }
        this.key = key;

        const newProps = this.getProperties(key, { x, y });
        const oldProps = this.lastProperties;
        this.lastProperties = newProps;

        // Let's compare the 2 maps:
        // First new properties vs oldProperties
        for (const [newPropName, newPropValue] of newProps.entries()) {
            const oldPropValue = oldProps.get(newPropName);
            if (oldPropValue !== newPropValue) {
                this.trigger(newPropName, oldPropValue, newPropValue, newProps);
            }
        }

        for (const [oldPropName, oldPropValue] of oldProps.entries()) {
            if (!newProps.has(oldPropName)) {
                // We found a property that disappeared
                this.trigger(oldPropName, oldPropValue, undefined, newProps);
            }
        }
    }

    public geoToMapPosition(coords: GeolocationCoordinates): Vector2 | undefined {
        if (this.topLeft && this.geocoordinationDimensions) {

            const mapPosition = new Vector2(coords)
                .sub(this.topLeft)
                .div(this.geocoordinationDimensions)
                .mult(this.mapDimensions)

            return mapPosition;
        }
        return undefined
    }

    public getCurrentProperties(): Map<string, string | boolean | number> {
        return this.lastProperties;
    }

    private getProperties(key: number, position: CustomVector): Map<string, string | boolean | number> {
        const properties = new Map<string, string | boolean | number>();

        const currentIndexPosition = new Vector2(position)
            .div(new Vector2(this.map.tilewidth, this.map.tileheight))
            .floor()


        for (const layer of this.layersIterator) {
            if (layer.type !== 'tilelayer') {
                continue;
            }

            let tileIndex: number | undefined = undefined;

            if (layer.chunks) {

                const currentChunk = layer.chunks.find(chunk => {
                    return chunk.x < currentIndexPosition.x && chunk.x + chunk.width + 1 > currentIndexPosition.x
                        && chunk.y < currentIndexPosition.y && chunk.y + chunk.height + 1 > currentIndexPosition.y
                })
                if (currentChunk && layer.startx !== undefined && layer.starty !== undefined) {
                    const chunkPosition = currentIndexPosition
                        .sub(new Vector2({ x: currentChunk.x, y: currentChunk.y }))
                    const chunkIndex = chunkPosition.y * currentChunk.width + chunkPosition.x

                    if (currentChunk.data[chunkIndex] == 0) {
                        continue;
                    }
                    tileIndex = currentChunk.data[chunkIndex]
                }

            } else if (layer.data) {
                const tiles = layer.data as number[];
                if (tiles[key] == 0) {
                    continue;
                }
                tileIndex = tiles[key]
            }

            // There is a tile in this layer, let's embed the properties
            if (layer.properties !== undefined) {
                for (const layerProperty of layer.properties) {
                    if (layerProperty.value === undefined) {
                        continue;
                    }
                    properties.set(layerProperty.name, layerProperty.value);
                }
            }

            if (tileIndex) {
                this.tileSetPropertyMap[tileIndex]?.forEach(property => {
                    if (property.value) {
                        properties.set(property.name, property.value)
                    } else if (properties.has(property.name)) {
                        properties.delete(property.name)
                    }
                })
            }
        }

        return properties;
    }

    private trigger(propName: string, oldValue: string | number | boolean | undefined, newValue: string | number | boolean | undefined, allProps: Map<string, string | boolean | number>) {
        const callbacksArray = this.callbacks.get(propName);
        if (callbacksArray !== undefined) {
            for (const callback of callbacksArray) {
                callback(newValue, oldValue, allProps);
            }
        }
    }

    /**
     * Registers a callback called when the user moves to a tile where the property propName is different from the last tile the user was on.
     */
    public onPropertyChange(propName: string, callback: PropertyChangeCallback) {
        let callbacksArray = this.callbacks.get(propName);
        if (callbacksArray === undefined) {
            callbacksArray = new Array<PropertyChangeCallback>();
            this.callbacks.set(propName, callbacksArray);
        }
        callbacksArray.push(callback);
    }
}
