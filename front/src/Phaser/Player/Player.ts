import { PlayerAnimationDirections } from "./Animation";
import type { GameScene } from "../Game/GameScene";
import { UserInputEvent, UserInputManager } from "../UserInput/UserInputManager";
import { Character } from "../Entity/Character";
import { userMovingStore } from "../../Stores/GameStore";
import { RadialMenu, RadialMenuClickEvent, RadialMenuItem } from "../Components/RadialMenu";
import type { Vector } from 'matter';
import { Vector2 } from '../../utility/vector';
import { dir } from 'console';

export const hasMovedEventName = "hasMoved";
export const requestEmoteEventName = "requestEmote";

export class Player extends Character {
    private previousDirection: string = PlayerAnimationDirections.Down;
    private wasMoving: boolean = false;
    private emoteMenu: RadialMenu | null = null;
    private updateListener: () => void;

    private devicePosition?: GeolocationPosition;
    private playerPosition?: GeolocationPosition;



    constructor(
        Scene: GameScene,
        x: number,
        y: number,
        name: string,
        texturesPromise: Promise<string[]>,
        direction: PlayerAnimationDirections,
        moving: boolean,
        private userInputManager: UserInputManager,
        companion: string | null,
        companionTexturePromise?: Promise<string>
    ) {
        super(Scene, x, y, texturesPromise, name, direction, moving, 1, true, companion, companionTexturePromise);

        //the current player model should be push away by other players to prevent conflict
        this.getBody().setImmovable(false);

        this.updateListener = () => {
            if (this.emoteMenu) {
                this.emoteMenu.x = this.x;
                this.emoteMenu.y = this.y;
            }
        };
        this.scene.events.addListener('postupdate', this.updateListener);

        if (this.scene.gameMap.geocoordinationDimensions) {
            navigator.geolocation.watchPosition(position => {
                this.devicePosition = position
            }, undefined, {
                enableHighAccuracy: true
            })
        }
    }

    moveUser(delta: number): void {
        //if user client on shift, camera and player speed
        let direction = null;
        let moving = false;

        const activeEvents = this.userInputManager.getEventListForGameTick();
        const speedMultiplier = activeEvents.get(UserInputEvent.SpeedUp) ? 25 : 9;
        const moveAmount = speedMultiplier * 20;

        let x = 0;
        let y = 0;
        if (activeEvents.get(UserInputEvent.MoveUp)) {
            y = -moveAmount;
            direction = PlayerAnimationDirections.Up;
            moving = true;
        } else if (activeEvents.get(UserInputEvent.MoveDown)) {
            y = moveAmount;
            direction = PlayerAnimationDirections.Down;
            moving = true;
        }
        if (activeEvents.get(UserInputEvent.MoveLeft)) {
            x = -moveAmount;
            direction = PlayerAnimationDirections.Left;
            moving = true;
        } else if (activeEvents.get(UserInputEvent.MoveRight)) {
            x = moveAmount;
            direction = PlayerAnimationDirections.Right;
            moving = true;
        }
        moving = moving || activeEvents.get(UserInputEvent.JoystickMove);

        if (x == 0 && y == 0 && this.playerPosition
            && this.devicePosition
            && this.scene.gameMap.geocoordinationDimensions !== undefined) {

            const mapPosition = this.scene.gameMap.geoToMapPosition(this.devicePosition.coords)

            if (mapPosition) {
                const delta = mapPosition.sub(new Vector2(this.x, this.y))
                    .round();

                x = delta.x
                y = delta.y;

                if (this.devicePosition.coords.heading) {
                    let heading = this.devicePosition.coords.heading + 45 % 360
                    if (this.scene.gameMap.geoRotation) {
                        heading *= this.scene.gameMap.geoRotation
                    }
                    if (heading > 270) {
                        direction = PlayerAnimationDirections.Left
                    } else if (heading > 180) {
                        direction = PlayerAnimationDirections.Down
                    } else if (heading > 90) {
                        direction = PlayerAnimationDirections.Right
                    } else {
                        direction = PlayerAnimationDirections.Up
                    }
                } else {
                    direction = PlayerAnimationDirections.Down
                }
            }
        }

        if (x !== 0 || y !== 0) {
            moving = true;
            this.move(x, y);
            this.emit(hasMovedEventName, { moving, direction, x: this.x, y: this.y });
        } else if (this.wasMoving && moving) {
            // slow joystick movement
            this.move(0, 0);
            this.emit(hasMovedEventName, { moving, direction: this.previousDirection, x: this.x, y: this.y });
        } else if (this.wasMoving && !moving) {
            this.stop();
            this.emit(hasMovedEventName, { moving, direction: this.previousDirection, x: this.x, y: this.y });
        }

        if (direction !== null) {
            this.previousDirection = direction;
        }
        this.wasMoving = moving;
        userMovingStore.set(moving);
        this.playerPosition = this.devicePosition
    }

    public isMoving(): boolean {
        return this.wasMoving;
    }

    openOrCloseEmoteMenu(emotes: RadialMenuItem[]) {
        if (this.emoteMenu) {
            this.closeEmoteMenu();
        } else {
            this.openEmoteMenu(emotes);
        }
    }

    openEmoteMenu(emotes: RadialMenuItem[]): void {
        this.cancelPreviousEmote();
        this.emoteMenu = new RadialMenu(this.scene, this.x, this.y, emotes)
        this.emoteMenu.on(RadialMenuClickEvent, (item: RadialMenuItem) => {
            this.closeEmoteMenu();
            this.emit(requestEmoteEventName, item.name);
            this.playEmote(item.name);
        });
    }

    closeEmoteMenu(): void {
        if (!this.emoteMenu) return;
        this.emoteMenu.destroy();
        this.emoteMenu = null;
    }

    destroy() {
        this.scene.events.removeListener('postupdate', this.updateListener);
        super.destroy();
    }
}
