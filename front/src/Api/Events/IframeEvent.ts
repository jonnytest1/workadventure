
import type { GameStateEvent } from './ApiGameStateEvent';
import type { UpdateTileEvent } from './ApiUpdateTileEvent';
import type { ButtonClickedEvent } from './ButtonClickedEvent';
import type { ChatEvent } from './ChatEvent';
import type { ClosePopupEvent } from './ClosePopupEvent';
import type { EnterLeaveEvent } from './EnterLeaveEvent';
import type { GoToPageEvent } from './GoToPageEvent';
import type { LoadPageEvent } from './LoadPageEvent';
import type { MenuItemClickedEvent } from './MenuItemClickedEvent';
import type { OpenPopupEvent } from './OpenPopupEvent';
import type { MenuItemRegisterEvent } from './MenuItemRegisterEvent';
import type { OpenTabEvent } from './OpenTabEvent';
import type { UserInputChatEvent } from './UserInputChatEvent';
import type { OpenCoWebSiteEvent } from './OpenCoWebSiteEvent';
import type { LoadSoundEvent } from "./LoadSoundEvent";
import type { MessageReferenceEvent, TriggerMessageEvent } from './TriggerMessageEvent';
import type { PlaySoundEvent } from './PlaySoundEvent';
export interface TypedMessageEvent<T> extends MessageEvent {
    data: T
}
export type IframeEventMap = {
    getState: GameStateEvent,
    updateTile: UpdateTileEvent
    chat: ChatEvent,
    openPopup: OpenPopupEvent
    closePopup: ClosePopupEvent
    openTab: OpenTabEvent
    goToPage: GoToPageEvent
    openCoWebSite: OpenCoWebSiteEvent
    closeCoWebSite: null
    disablePlayerControls: null
    restorePlayerControls: null
    displayBubble: null
    removeBubble: null
    enableMoveEvents: undefined
    registerMenuCommand: MenuItemRegisterEvent
    loadPage: LoadPageEvent
    triggerMessage: TriggerMessageEvent
    removeTriggerMessage: MessageReferenceEvent
    loadSound: LoadSoundEvent
    playSound: PlaySoundEvent
    stopSound: null,
}
export interface IframeEvent<T extends keyof IframeEventMap> {
    type: T;
    data: IframeEventMap[T];
}




// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isIframeEventWrapper = (event: any): event is IframeEvent<keyof IframeEventMap> => typeof event.type === 'string';

export interface IframeResponseEventMap {
    menuItemClicked: MenuItemClickedEvent
    userInputChat: UserInputChatEvent
    enterEvent: EnterLeaveEvent
    leaveEvent: EnterLeaveEvent
    buttonClickedEvent: ButtonClickedEvent
    gameState: GameStateEvent

    messageTriggered: MessageReferenceEvent
    hasMovedEvent: string
    listenersRegistered: undefined
}
export interface IframeResponseEvent<T extends keyof IframeResponseEventMap> {
    type: T;
    data: IframeResponseEventMap[T];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isIframeResponseEventWrapper = (event: { type?: string }): event is IframeResponseEvent<keyof IframeResponseEventMap> => typeof event.type === 'string';