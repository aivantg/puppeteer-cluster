import * as puppeteer from 'puppeteer';

import { debugGenerator, timeoutExecute } from '../../util';
import ConcurrencyImplementation, { WorkerInstance } from '../ConcurrencyImplementation';
const debug = debugGenerator('BrowserConcurrency');

const BROWSER_TIMEOUT = 5000;

// @ts-ignore
declare const Buffer

export default class Browser extends ConcurrencyImplementation {
    public async init() {}
    public async close() {}

    public async workerInstance(perBrowserOptions: puppeteer.LaunchOptions | undefined):
        Promise<WorkerInstance> {

        const options = perBrowserOptions || this.options;
        let chrome = await this.puppeteer.launch(options) as puppeteer.Browser;

        chrome.encoders = new Map();

        const extensionTarget = await chrome.waitForTarget(
            // @ts-ignore
            (target) => target.type() === "background_page" && target._targetInfo.title === "Video Capture"
        );
    
        // @ts-ignore
        chrome.videoCaptureExtension = await extensionTarget.page();

        const str2ab = (str: any) => {
            // Convert a UTF-8 String to an ArrayBuffer
        
            var buf = new ArrayBuffer(str.length); // 1 byte for each char
            var bufView = new Uint8Array(buf);
        
            for (var i = 0, strLen = str.length; i < strLen; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            return buf;
        }
    
        // @ts-ignore
        await chrome.videoCaptureExtension.exposeFunction("sendData", (opts: any) => {
            const data = Buffer.from(str2ab(opts.data));
            // @ts-ignore
            chrome.encoders.get(opts.id).push(data);
        });

        let page: puppeteer.Page;
        let context: any; // puppeteer typings are old...

        return {
            jobInstance: async () => {
                await timeoutExecute(BROWSER_TIMEOUT, (async () => {
                    context = await chrome.createIncognitoBrowserContext();
                    page = await context.newPage();
                })());

                return {
                    resources: {
                        page,
                    },

                    close: async () => {
                        await timeoutExecute(BROWSER_TIMEOUT, context.close());
                    },
                };
            },

            close: async () => {
                await chrome.close();
            },

            repair: async () => {
                debug('Starting repair');
                try {
                    // will probably fail, but just in case the repair was not necessary
                    await chrome.close();
                } catch (e) {}

                // just relaunch as there is only one page per browser
                chrome = await this.puppeteer.launch(this.options);
                chrome.encoders = new Map();

                const extensionTarget = await chrome.waitForTarget(
                    // @ts-ignore
                    (target) => target.type() === "background_page" && target._targetInfo.title === "Video Capture"
                );
            
                // @ts-ignore
                chrome.videoCaptureExtension = await extensionTarget.page();

                const str2ab = (str: any) => {
                    // Convert a UTF-8 String to an ArrayBuffer
                
                    var buf = new ArrayBuffer(str.length); // 1 byte for each char
                    var bufView = new Uint8Array(buf);
                
                    for (var i = 0, strLen = str.length; i < strLen; i++) {
                        bufView[i] = str.charCodeAt(i);
                    }
                    return buf;
                }
            
                // @ts-ignore
                await chrome.videoCaptureExtension.exposeFunction("sendData", (opts: any) => {
                    const data = Buffer.from(str2ab(opts.data));
                    // @ts-ignore
                    chrome.encoders.get(opts.id).push(data);
                });
            },
        };
    }

}
