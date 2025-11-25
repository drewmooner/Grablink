declare module 'random-useragent' {
  interface UserAgent {
    browserName?: string;
    deviceType?: string;
  }
  
  function getRandom(filter?: (ua: UserAgent) => boolean): string | null;
  
  export default {
    getRandom,
  };
}

