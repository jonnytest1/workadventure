import {Subject} from "rxjs";
import {ChatEvent, isChatEvent} from "./Events/ChatEvent";
import {IframeEvent, isIframeEventWrapper} from "./Events/IframeEvent";
import {UserInputChatEvent} from "./Events/UserInputChatEvent";
import * as crypto from "crypto";
import {HtmlUtils} from "../WebRtc/HtmlUtils";
import {EnterLeaveEvent} from "./Events/EnterLeaveEvent";
import {isOpenPopupEvent, OpenPopupEvent} from "./Events/OpenPopupEvent";
import {isOpenTabEvent, OpenTabEvent} from "./Events/OpenTabEvent";
import {ButtonClickedEvent} from "./Events/ButtonClickedEvent";
import {ClosePopupEvent, isClosePopupEvent} from "./Events/ClosePopupEvent";
import {scriptUtils} from "./ScriptUtils";
import {GoToPageEvent, isGoToPageEvent} from "./Events/GoToPageEvent";
import {isOpenCoWebsite, OpenCoWebSiteEvent} from "./Events/OpenCoWebSiteEvent";
import { isLoadPageEvent } from './Events/LoadPageEvent';


/**
 * Listens to messages from iframes and turn those messages into easy to use observables.
 * Also allows to send messages to those iframes.
 */
class IframeListener {
    private readonly _chatStream: Subject<ChatEvent> = new Subject();
    public readonly chatStream = this._chatStream.asObservable();

    private readonly _openPopupStream: Subject<OpenPopupEvent> = new Subject();
    public readonly openPopupStream = this._openPopupStream.asObservable();

    private readonly _openTabStream: Subject<OpenTabEvent> = new Subject();
    public readonly openTabStream = this._openTabStream.asObservable();

    private readonly _goToPageStream: Subject<GoToPageEvent> = new Subject();
    public readonly goToPageStream = this._goToPageStream.asObservable();

    
    private readonly _loadPageStream: Subject<string> = new Subject();
    public readonly loadPageStream = this._loadPageStream.asObservable();

    private readonly _openCoWebSiteStream: Subject<OpenCoWebSiteEvent> = new Subject();
    public readonly openCoWebSiteStream = this._openCoWebSiteStream.asObservable();

    private readonly _closeCoWebSiteStream: Subject<void> = new Subject();
    public readonly closeCoWebSiteStream = this._closeCoWebSiteStream.asObservable();

    private readonly _disablePlayerControlStream: Subject<void> = new Subject();
    public readonly disablePlayerControlStream = this._disablePlayerControlStream.asObservable();

    private readonly _enablePlayerControlStream: Subject<void> = new Subject();
    public readonly enablePlayerControlStream = this._enablePlayerControlStream.asObservable();

    private readonly _closePopupStream: Subject<ClosePopupEvent> = new Subject();
    public readonly closePopupStream = this._closePopupStream.asObservable();

    private readonly _displayBubbleStream: Subject<void> = new Subject();
    public readonly displayBubbleStream = this._displayBubbleStream.asObservable();

    private readonly _removeBubbleStream: Subject<void> = new Subject();
    public readonly removeBubbleStream = this._removeBubbleStream.asObservable();

    private readonly iframes = new Set<HTMLIFrameElement>();
    private readonly scripts = new Map<string, HTMLIFrameElement>();

    init() {
        window.addEventListener("message", (message) => {
            // Do we trust the sender of this message?
            // Let's only accept messages from the iframe that are allowed.
            // Note: maybe we could restrict on the domain too for additional security (in case the iframe goes to another domain).
            let found = false;
            for (const iframe of this.iframes) {
                if (iframe.contentWindow === message.source) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return;
            }

            const payload = message.data;
            if (isIframeEventWrapper(payload)) {
                if (payload.type === 'chat' && isChatEvent(payload.data)) {
                    this._chatStream.next(payload.data);
                } else if (payload.type === 'openPopup' && isOpenPopupEvent(payload.data)) {
                    this._openPopupStream.next(payload.data);
                } else if (payload.type === 'closePopup' && isClosePopupEvent(payload.data)) {
                    this._closePopupStream.next(payload.data);
                }
                else if(payload.type === 'openTab' && isOpenTabEvent(payload.data)) {
                    scriptUtils.openTab(payload.data.url);
                }
                else if(payload.type === 'goToPage' && isGoToPageEvent(payload.data)) {
                    scriptUtils.goToPage(payload.data.url);
                }
                else if(payload.type === 'openCoWebSite' && isOpenCoWebsite(payload.data)) {
                    scriptUtils.openCoWebsite(payload.data.url);
                }
                else if(payload.type === 'closeCoWebSite') {
                    scriptUtils.closeCoWebSite();
                }
                else if (payload.type === 'disablePlayerControl'){
                    this._disablePlayerControlStream.next();
                }
                else if (payload.type === 'restorePlayerControl'){
                    this._enablePlayerControlStream.next();
                }
                else if (payload.type === 'displayBubble'){
                    this._displayBubbleStream.next();
                }
                else if (payload.type === 'removeBubble'){
                    this._removeBubbleStream.next();
                }else if (payload.type === 'loadPage' && isLoadPageEvent(payload.data)){
                    this._loadPageStream.next(payload.data.url);
                }
            }


        }, false);

    }

    /**
     * Allows the passed iFrame to send/receive messages via the API.
     */
    registerIframe(iframe: HTMLIFrameElement): void {
        this.iframes.add(iframe);
    }

    unregisterIframe(iframe: HTMLIFrameElement): void {
        this.iframes.delete(iframe);
    }

    registerScript(scriptUrl: string): void {
        console.log('Loading map related script at ', scriptUrl)

        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            // Using external iframe mode (
            const iframe = document.createElement('iframe');
            iframe.id = this.getIFrameId(scriptUrl);
            iframe.style.display = 'none';
            iframe.src = '/iframe.html?script='+encodeURIComponent(scriptUrl);

            // We are putting a sandbox on this script because it will run in the same domain as the main website.
            iframe.sandbox.add('allow-scripts');
            iframe.sandbox.add('allow-top-navigation-by-user-activation');

            document.body.prepend(iframe);

            this.scripts.set(scriptUrl, iframe);
            this.registerIframe(iframe);
        } else {
            // production code
            const iframe = document.createElement('iframe');
            iframe.id = this.getIFrameId(scriptUrl);
            iframe.style.display = 'none';

            // We are putting a sandbox on this script because it will run in the same domain as the main website.
            iframe.sandbox.add('allow-scripts');
            iframe.sandbox.add('allow-top-navigation-by-user-activation');

            const html = '<!doctype html>\n' +
                '\n' +
                '<html lang="en">\n' +
                '<head>\n' +
                '<script src="'+window.location.protocol+'//'+window.location.host+'/iframe_api.js" ></script>\n' +
                '<script src="'+scriptUrl+'" ></script>\n' +
                '</head>\n' +
                '</html>\n';

            //iframe.src = "data:text/html;charset=utf-8," + escape(html);
            iframe.srcdoc = html;

            document.body.prepend(iframe);

            this.scripts.set(scriptUrl, iframe);
            this.registerIframe(iframe);
        }


    }

    private getIFrameId(scriptUrl: string): string {
        return 'script'+crypto.createHash('md5').update(scriptUrl).digest("hex");
    }

    unregisterScript(scriptUrl: string): void {
        const iFrameId = this.getIFrameId(scriptUrl);
        const iframe = HtmlUtils.getElementByIdOrFail<HTMLIFrameElement>(iFrameId);
        if (!iframe) {
            throw new Error('Unknown iframe for script "'+scriptUrl+'"');
        }
        this.unregisterIframe(iframe);
        iframe.remove();

        this.scripts.delete(scriptUrl);
    }

    sendUserInputChat(message: string) {
        this.postMessage({
            'type': 'userInputChat',
            'data': {
                'message': message,
            } as UserInputChatEvent
        });
    }

    sendEnterEvent(name: string) {
        this.postMessage({
            'type': 'enterEvent',
            'data': {
                "name": name
            } as EnterLeaveEvent
        });
    }

    sendLeaveEvent(name: string) {
        this.postMessage({
            'type': 'leaveEvent',
            'data': {
                "name": name
            } as EnterLeaveEvent
        });
    }

    sendButtonClickedEvent(popupId: number, buttonId: number): void {
        this.postMessage({
            'type': 'buttonClickedEvent',
            'data': {
                popupId,
                buttonId
            } as ButtonClickedEvent
        });
    }

    /**
     * Sends the message... to all allowed iframes.
     */
    private postMessage(message: IframeEvent) {
        for (const iframe of this.iframes) {
            iframe.contentWindow?.postMessage(message, '*');
        }
    }

}

export const iframeListener = new IframeListener();
