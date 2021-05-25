import { Subscription } from 'rxjs';
import { PlayerStateObject } from '../../Api/Events/ApiGameStateEvent';
import { iframeListener } from '../../Api/IframeListener';
import { localUserStore } from '../../Connexion/LocalUserStore';
import { HtmlUtils } from '../../WebRtc/HtmlUtils';
import { layoutManager } from '../../WebRtc/LayoutManager';
import { RemotePlayer } from '../Entity/RemotePlayer';
import { Sprite } from '../Entity/Sprite';
import { ITiledMapObject } from '../Map/ITiledMap';
import { GameScene } from './GameScene';
import EVENT_TYPE = Phaser.Scenes.Events

let iframeSubscriptionList: Array<Subscription> = []

class GameSceneIframeListeners {

    registerListeners(gameScene: GameScene) {
        iframeSubscriptionList.push(iframeListener.triggerMessageEvent.subscribe(message => {
            layoutManager.addActionButton(message.uuid, message.message, () => {
                iframeListener.sendMessageTriggeredEvent(message.uuid)
                layoutManager.removeActionButton(message.uuid, gameScene.userInputManager);
            }, gameScene.userInputManager);
        }))

        iframeSubscriptionList.push(iframeListener.removeTriggerMessageEvent.subscribe(message => {
            layoutManager.removeActionButton(message.uuid, gameScene.userInputManager);
        }))

        iframeSubscriptionList.push(iframeListener.openPopupStream.subscribe((openPopupEvent) => {

            let objectLayerSquare: ITiledMapObject;
            const targetObjectData = this.getObjectLayerData(openPopupEvent.targetObject, gameScene);
            if (targetObjectData !== undefined) {
                objectLayerSquare = targetObjectData;
            } else {
                console.error("Error while opening a popup. Cannot find an object on the map with name '" + openPopupEvent.targetObject + "'. The first parameter of WA.openPopup() must be the name of a rectangle object in your map.");
                return;
            }
            const escapedMessage = HtmlUtils.escapeHtml(openPopupEvent.message);
            let html = `<div id="container" hidden><div class="nes-container with-title is-centered">
${escapedMessage}
</div> `;
            const buttonContainer = `<div class="buttonContainer"</div>`;
            html += buttonContainer;
            let id = 0;
            for (const button of openPopupEvent.buttons) {
                html += `<button type="button" class="nes-btn is-${HtmlUtils.escapeHtml(button.className ?? '')}" id="popup-${openPopupEvent.popupId}-${id}">${HtmlUtils.escapeHtml(button.label)}</button>`;
                id++;
            }
            html += '</div>';
            const domElement = gameScene.add.dom(objectLayerSquare.x,
                objectLayerSquare.y).createFromHTML(html);

            const container: HTMLDivElement = domElement.getChildByID("container") as HTMLDivElement;
            container.style.width = objectLayerSquare.width + "px";
            domElement.scale = 0;
            domElement.setClassName('popUpElement');

            setTimeout(() => {
                (container).hidden = false;
            }, 100);

            id = 0;
            for (const button of openPopupEvent.buttons) {
                const button = HtmlUtils.getElementByIdOrFail<HTMLButtonElement>(`popup-${openPopupEvent.popupId}-${id}`);
                const btnId = id;
                button.onclick = () => {
                    iframeListener.sendButtonClickedEvent(openPopupEvent.popupId, btnId);
                    button.disabled = true;
                }
                id++;
            }
            gameScene.tweens.add({
                targets: domElement,
                scale: 1,
                ease: "EaseOut",
                duration: 400,
            });

            gameScene.popUpElements.set(openPopupEvent.popupId, domElement);
        }));

        iframeSubscriptionList.push(iframeListener.closePopupStream.subscribe((closePopupEvent) => {
            const popUpElement = gameScene.popUpElements.get(closePopupEvent.popupId);
            if (popUpElement === undefined) {
                console.error('Could not close popup with ID ', closePopupEvent.popupId, '. Maybe it has already been closed?');
            }

            gameScene.tweens.add({
                targets: popUpElement,
                scale: 0,
                ease: "EaseOut",
                duration: 400,
                onComplete: () => {
                    popUpElement?.destroy();
                    gameScene.popUpElements.delete(closePopupEvent.popupId);
                },
            });
        }));

        iframeSubscriptionList.push(iframeListener.disablePlayerControlStream.subscribe(() => {
            gameScene.userInputManager.disableControls();
        }));

        iframeSubscriptionList.push(iframeListener.enablePlayerControlStream.subscribe(() => {
            gameScene.userInputManager.restoreControls();
        }));
        iframeSubscriptionList.push(iframeListener.loadPageStream.subscribe((url: string) => {
            gameScene.loadNextGame(url).then(() => {
                gameScene.events.once(EVENT_TYPE.POST_UPDATE, () => {
                    gameScene.onMapExit(url);
                })
            })
        }));
        iframeSubscriptionList.push(iframeListener.gameStateStream.subscribe(() => {
            const playerObject: PlayerStateObject = {
                [gameScene.playerName]: {
                    position: {
                        x: gameScene.CurrentPlayer.x,
                        y: gameScene.CurrentPlayer.y
                    },
                    pusherId: gameScene.connection?.getUserId()
                }
            }
            for (const mapPlayer of gameScene.MapPlayers.children.entries) {
                const remotePlayer: RemotePlayer = mapPlayer as RemotePlayer;
                playerObject[remotePlayer.PlayerValue] = {
                    position: {
                        x: remotePlayer.x,
                        y: remotePlayer.y
                    },
                    pusherId: remotePlayer.userId

                }
            }
            iframeListener.sendFrozenGameStateEvent({
                mapUrl: gameScene.MapUrlFile,
                nickName: gameScene.playerName,
                startLayerName: gameScene.startLayerName,
                uuid: localUserStore.getLocalUser()?.uuid,
                roomId: gameScene.RoomId,
                data: gameScene.mapFile,
                players: playerObject
            })
        }));


        iframeSubscriptionList.push(iframeListener.updateTileEvent.subscribe(event => {

            for (const eventTile of event) {
                const layer = gameScene.Layers.find(layer => layer.layer.name == eventTile.layer)
                if (layer) {
                    const tile = layer.getTileAt(eventTile.x, eventTile.y)
                    if (tile) {
                        if (typeof eventTile.tile == "string") {
                            const tileIndex = this.getIndexForTileType(eventTile.tile, gameScene);
                            if (tileIndex) {
                                tile.index = tileIndex
                            } else {
                                return
                            }
                        } else {
                            tile.index = eventTile.tile
                        }
                    }
                }
            }
            gameScene.scene.scene.sys.game.events.emit("contextrestored")
        }))

        let scriptedBubbleSprite: Sprite;
        iframeSubscriptionList.push(iframeListener.displayBubbleStream.subscribe(() => {
            scriptedBubbleSprite = new Sprite(gameScene, gameScene.CurrentPlayer.x + 25, gameScene.CurrentPlayer.y, 'circleSprite-white');
            scriptedBubbleSprite.setDisplayOrigin(48, 48);
            gameScene.add.existing(scriptedBubbleSprite);
        }));

        iframeSubscriptionList.push(iframeListener.removeBubbleStream.subscribe(() => {
            scriptedBubbleSprite.destroy();
        }));


        iframeListener.sendListenersRegisteredEvent()
    }


    public unregisterListeners(): void {
        for (const iframeEvents of iframeSubscriptionList) {
            iframeEvents.unsubscribe();
        }
        iframeSubscriptionList = []
    }

    private getObjectLayerData(objectName: string, gameScene: GameScene): ITiledMapObject | undefined {
        for (const layer of gameScene.mapFile.layers) {
            if (layer.type === 'objectgroup' && layer.name === 'floorLayer') {
                for (const object of layer.objects) {
                    if (object.name === objectName) {
                        return object;
                    }
                }
            }
        }
        return undefined;

    }


    private getIndexForTileType(tileType: string, gameScene: GameScene): number | null {
        for (const tileset of gameScene.mapFile.tilesets) {
            if (tileset.tiles) {
                for (const tilesetTile of tileset.tiles) {
                    if (tilesetTile.type == tileType) {
                        return tileset.firstgid + tilesetTile.id
                    }
                }
            }
        }
        return null
    }
}

export const gameSceneIframeListeners = new GameSceneIframeListeners()