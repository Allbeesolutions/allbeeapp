import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRealtimeReconnect } from "./realtimeReconnect.js";

describe("realtime reconnect stress", () => {
 beforeEach(()=>vi.useFakeTimers());
 afterEach(()=>vi.useRealTimers());

 it("survives 200 disconnect/reconnect cycles without reusing stale callbacks",()=>{
   const channels=[];
   const createChannel=vi.fn(handler=>{
     const ch={ handler, unsubscribe:vi.fn() };
     channels.push(ch);return ch;
   });
   const onReconnect=vi.fn(),onError=vi.fn();
   const r=createRealtimeReconnect({createChannel,onReconnect,onError,retryBaseMs:1,retryMaxMs:2});
   for(let i=0;i<200;i++){
     channels.at(-1).handler("SUBSCRIBED");
     channels.at(-1).handler("CHANNEL_ERROR");
     vi.advanceTimersByTime(2);
     // An old event arriving after replacement must not disrupt the new channel.
     channels.at(-2)?.handler("CLOSED");
     channels.at(-2)?.handler("SUBSCRIBED");
   }
   channels.at(-1).handler("SUBSCRIBED");
   expect(createChannel).toHaveBeenCalledTimes(201);
   expect(onReconnect).toHaveBeenCalledTimes(201);
   expect(channels.slice(0,-1).every(ch=>ch.unsubscribe.mock.calls.length===1)).toBe(true);
   r.stop();
   channels.forEach(ch=>ch.handler("CLOSED"));
   vi.runOnlyPendingTimers();
   expect(createChannel).toHaveBeenCalledTimes(201);
   expect(channels.at(-1).unsubscribe).toHaveBeenCalledTimes(1);
 });

 it("keeps separate tab reconnect controllers independent",()=>{
   const tabA=[],tabB=[],reloadA=vi.fn(),reloadB=vi.fn();
   const make=(list,onReconnect)=>createRealtimeReconnect({
     createChannel:(handler)=>{const ch={handler,unsubscribe:vi.fn()};list.push(ch);return ch;},
     onReconnect,retryBaseMs:10
   });
   const a=make(tabA,reloadA),b=make(tabB,reloadB);
   tabA[0].handler("CHANNEL_ERROR");
   tabB[0].handler("SUBSCRIBED");
   vi.advanceTimersByTime(10);
   tabA[1].handler("SUBSCRIBED");
   expect(reloadA).toHaveBeenCalledTimes(1);
   expect(reloadB).toHaveBeenCalledTimes(1);
   expect(tabB).toHaveLength(1);
   a.stop();
   tabB[0].handler("CHANNEL_ERROR");
   vi.advanceTimersByTime(10);
   expect(tabB).toHaveLength(2);
   b.stop();
 });
});
